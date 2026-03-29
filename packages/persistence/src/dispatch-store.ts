import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  type ResolvePersistenceConfigOptions,
  resolvePersistenceConfig,
} from "@runroot/config";
import type { DispatchJob, DispatchQueue } from "@runroot/dispatch";
import type { Pool, PoolClient } from "pg";
import type {
  BindParams,
  Database as SqliteDatabase,
  SqlJsStatic,
} from "sql.js";
import initSqlJs from "sql.js/dist/sql-asm.js";
import {
  migratePostgresPersistence,
  migrateSqlitePersistence,
  type PostgresRuntimePersistenceOptions,
  type SqliteRuntimePersistenceOptions,
} from "./database-store";
import { getRuntimePersistenceMigrations } from "./migrations";

type DispatchIdGenerator = () => string;
type SqlPrimitive = number | string | null;
type SqlQueryRow = Readonly<Record<string, unknown>>;

interface SqlClient {
  readonly dialect: "postgres" | "sqlite";
  execute(sql: string, params?: readonly SqlPrimitive[]): Promise<number>;
  queryRows<TRow extends SqlQueryRow>(
    sql: string,
    params?: readonly SqlPrimitive[],
  ): Promise<readonly TRow[]>;
}

type PostgresPoolLike = Pick<Pool, "connect">;

export interface PostgresDispatchQueueOptions
  extends Pick<PostgresRuntimePersistenceOptions, "databaseUrl" | "pool"> {
  readonly idGenerator?: DispatchIdGenerator;
}

export interface SqliteDispatchQueueOptions
  extends Pick<
    SqliteRuntimePersistenceOptions,
    "filePath" | "lockRetryDelayMs" | "lockTimeoutMs"
  > {
  readonly idGenerator?: DispatchIdGenerator;
}

export interface ConfiguredDispatchQueueOptions
  extends ResolvePersistenceConfigOptions {
  readonly idGenerator?: DispatchIdGenerator;
  readonly lockRetryDelayMs?: number;
  readonly lockTimeoutMs?: number;
  readonly pool?: PostgresPoolLike;
}

const defaultIdGenerator: DispatchIdGenerator = () =>
  `dispatch_${randomUUID()}`;
let sqliteModulePromise: Promise<SqlJsStatic> | undefined;

export function createConfiguredDispatchQueue(
  options: ConfiguredDispatchQueueOptions = {},
): DispatchQueue {
  const resolved = resolvePersistenceConfig(options);

  switch (resolved.driver) {
    case "file":
      throw new Error(
        'Queued execution requires SQLite or Postgres persistence. The legacy "file" adapter only supports inline execution.',
      );
    case "postgres":
      return createPostgresDispatchQueue({
        ...(resolved.databaseUrl ? { databaseUrl: resolved.databaseUrl } : {}),
        ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
        ...(options.pool ? { pool: options.pool } : {}),
      });
    case "sqlite":
      return createSqliteDispatchQueue({
        filePath: resolved.sqlitePath ?? resolved.location,
        ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
        ...(options.lockRetryDelayMs !== undefined
          ? { lockRetryDelayMs: options.lockRetryDelayMs }
          : {}),
        ...(options.lockTimeoutMs !== undefined
          ? { lockTimeoutMs: options.lockTimeoutMs }
          : {}),
      });
  }
}

export function createPostgresDispatchQueue(
  options: PostgresDispatchQueueOptions = {},
): DispatchQueue {
  const idGenerator = options.idGenerator ?? defaultIdGenerator;
  const pool = options.pool ?? createDefaultPool(options.databaseUrl);
  let schemaReadyPromise: Promise<void> | undefined;

  return createDatabaseDispatchQueue({
    ensureSchema() {
      schemaReadyPromise ??= migratePostgresPersistence({
        ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
        ...(options.pool ? { pool: options.pool } : {}),
      }).then(() => undefined);

      return schemaReadyPromise;
    },
    idGenerator,
    withReadOnlyClient(task) {
      return withPostgresClient(pool, task);
    },
    withTransaction(task) {
      return withPostgresTransaction(pool, task);
    },
  });
}

export function createSqliteDispatchQueue(
  options: SqliteDispatchQueueOptions,
): DispatchQueue {
  const filePath = resolve(options.filePath);
  const idGenerator = options.idGenerator ?? defaultIdGenerator;
  let accessQueue = Promise.resolve();
  let schemaReadyPromise: Promise<void> | undefined;

  return createDatabaseDispatchQueue({
    ensureSchema() {
      schemaReadyPromise ??= migrateSqlitePersistence({
        filePath,
      }).then(() => undefined);

      return schemaReadyPromise;
    },
    idGenerator,
    withReadOnlyClient(task) {
      return enqueueAccess(async () =>
        withSqliteClient(
          {
            filePath,
            mutable: false,
          },
          task,
        ),
      );
    },
    withTransaction(task) {
      return enqueueAccess(async () =>
        withFileLock(filePath, options, async () =>
          withSqliteClient(
            {
              filePath,
              mutable: true,
            },
            task,
          ),
        ),
      );
    },
  });

  async function enqueueAccess<TValue>(
    action: () => Promise<TValue>,
  ): Promise<TValue> {
    const pendingAccess = accessQueue.then(action, action);
    accessQueue = pendingAccess.then(
      () => undefined,
      () => undefined,
    );

    return pendingAccess;
  }
}

function createDatabaseDispatchQueue(options: {
  readonly ensureSchema: () => Promise<void>;
  readonly idGenerator: DispatchIdGenerator;
  readonly withReadOnlyClient: <TValue>(
    task: (client: SqlClient) => Promise<TValue>,
  ) => Promise<TValue>;
  readonly withTransaction: <TValue>(
    task: (client: SqlClient) => Promise<TValue>,
  ) => Promise<TValue>;
}): DispatchQueue {
  return {
    async claimNext(input) {
      await options.ensureSchema();

      return options.withTransaction(async (client) => {
        const candidateRows = await client.queryRows<{
          data: string;
          id: string;
        }>(
          `SELECT id, data
           FROM runroot_dispatch_jobs
           WHERE status = ? AND available_at <= ?
           ORDER BY available_at ASC, enqueued_at ASC, id ASC
           LIMIT 1`,
          ["queued", input.claimedAt],
        );
        const candidateRow = candidateRows[0];

        if (!candidateRow) {
          return undefined;
        }

        const candidate = deserializeRow<DispatchJob>(candidateRow.data);
        const claimedJob: DispatchJob = {
          ...candidate,
          attempts: candidate.attempts + 1,
          claimedAt: input.claimedAt,
          claimedBy: input.workerId,
          status: "claimed",
        };
        const affectedRows = await client.execute(
          `UPDATE runroot_dispatch_jobs
           SET attempts = ?, claimed_at = ?, claimed_by = ?, status = ?, data = ?
           WHERE id = ? AND status = ?`,
          [
            claimedJob.attempts,
            claimedJob.claimedAt ?? null,
            claimedJob.claimedBy ?? null,
            claimedJob.status,
            serializeRow(claimedJob),
            claimedJob.id,
            "queued",
          ],
        );

        return affectedRows > 0 ? clone(claimedJob) : undefined;
      });
    },

    async complete(jobId, completedAt) {
      return updateJobStatus(jobId, completedAt, (job) => ({
        ...job,
        completedAt,
        status: "completed",
      }));
    },

    async enqueue(input) {
      await options.ensureSchema();

      const queuedJob: DispatchJob = {
        attempts: 0,
        availableAt: input.availableAt ?? input.enqueuedAt,
        definitionId: input.definitionId,
        enqueuedAt: input.enqueuedAt,
        id: options.idGenerator(),
        kind: input.kind,
        runId: input.runId,
        status: "queued",
      };

      await options.withTransaction(async (client) => {
        await client.execute(
          `INSERT INTO runroot_dispatch_jobs (
             id,
             kind,
             run_id,
             definition_id,
             status,
             attempts,
             enqueued_at,
             available_at,
             claimed_at,
             claimed_by,
             completed_at,
             data
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            queuedJob.id,
            queuedJob.kind,
            queuedJob.runId,
            queuedJob.definitionId,
            queuedJob.status,
            queuedJob.attempts,
            queuedJob.enqueuedAt,
            queuedJob.availableAt,
            null,
            null,
            null,
            serializeRow(queuedJob),
          ],
        );
      });

      return clone(queuedJob);
    },

    async fail(jobId, failedAt, failureMessage) {
      return updateJobStatus(jobId, failedAt, (job) => ({
        ...job,
        completedAt: failedAt,
        failureMessage,
        status: "failed",
      }));
    },

    async get(jobId) {
      await options.ensureSchema();

      return options.withReadOnlyClient(async (client) => {
        const rows = await client.queryRows<{ data: string }>(
          "SELECT data FROM runroot_dispatch_jobs WHERE id = ?",
          [jobId],
        );

        return rows[0] ? deserializeRow<DispatchJob>(rows[0].data) : undefined;
      });
    },

    async list(status) {
      await options.ensureSchema();

      return options.withReadOnlyClient(async (client) => {
        const rows = status
          ? await client.queryRows<{ data: string }>(
              `SELECT data
               FROM runroot_dispatch_jobs
               WHERE status = ?
               ORDER BY available_at ASC, enqueued_at ASC, id ASC`,
              [status],
            )
          : await client.queryRows<{ data: string }>(
              `SELECT data
               FROM runroot_dispatch_jobs
               ORDER BY available_at ASC, enqueued_at ASC, id ASC`,
            );

        return rows.map((row) => deserializeRow<DispatchJob>(row.data));
      });
    },

    async listByRunId(runId) {
      await options.ensureSchema();

      return options.withReadOnlyClient(async (client) => {
        const rows = await client.queryRows<{ data: string }>(
          `SELECT data
           FROM runroot_dispatch_jobs
           WHERE run_id = ?
           ORDER BY enqueued_at ASC, id ASC`,
          [runId],
        );

        return rows.map((row) => deserializeRow<DispatchJob>(row.data));
      });
    },
  };

  async function updateJobStatus(
    jobId: string,
    completedAt: string,
    update: (job: DispatchJob) => DispatchJob,
  ): Promise<DispatchJob | undefined> {
    await options.ensureSchema();

    return options.withTransaction(async (client) => {
      const rows = await client.queryRows<{ data: string }>(
        "SELECT data FROM runroot_dispatch_jobs WHERE id = ?",
        [jobId],
      );
      const currentRow = rows[0];

      if (!currentRow) {
        return undefined;
      }

      const nextJob = update(deserializeRow<DispatchJob>(currentRow.data));

      await client.execute(
        `UPDATE runroot_dispatch_jobs
         SET status = ?, completed_at = ?, data = ?
         WHERE id = ?`,
        [
          nextJob.status,
          nextJob.completedAt ?? completedAt,
          serializeRow(nextJob),
          jobId,
        ],
      );

      return clone(nextJob);
    });
  }
}

class PostgresSqlClient implements SqlClient {
  readonly dialect = "postgres" as const;

  constructor(private readonly client: PoolClient) {}

  async execute(
    sql: string,
    params: readonly SqlPrimitive[] = [],
  ): Promise<number> {
    const result = await this.client.query(
      convertQuestionMarksToPostgres(sql),
      [...params],
    );

    return result.rowCount ?? 0;
  }

  async queryRows<TRow extends SqlQueryRow>(
    sql: string,
    params: readonly SqlPrimitive[] = [],
  ): Promise<readonly TRow[]> {
    const result = await this.client.query<TRow>(
      convertQuestionMarksToPostgres(sql),
      [...params],
    );

    return result.rows;
  }
}

class SqliteSqlClient implements SqlClient {
  readonly dialect = "sqlite" as const;

  constructor(private readonly database: SqliteDatabase) {}

  async execute(
    sql: string,
    params: readonly SqlPrimitive[] = [],
  ): Promise<number> {
    this.database.run(sql, toSqliteParams(params));

    return this.database.getRowsModified();
  }

  async queryRows<TRow extends SqlQueryRow>(
    sql: string,
    params: readonly SqlPrimitive[] = [],
  ): Promise<readonly TRow[]> {
    const statement = this.database.prepare(sql, toSqliteParams(params));
    const rows: TRow[] = [];

    try {
      while (statement.step()) {
        rows.push(statement.getAsObject() as TRow);
      }
    } finally {
      statement.free();
    }

    return rows;
  }
}

function createDefaultPool(databaseUrl?: string): PostgresPoolLike {
  if (!databaseUrl) {
    throw new Error(
      'Postgres queued execution requires DATABASE_URL or an explicit "databaseUrl" option.',
    );
  }

  const { Pool } = require("pg") as typeof import("pg");

  return new Pool({
    connectionString: databaseUrl,
  });
}

async function withPostgresClient<TValue>(
  pool: PostgresPoolLike,
  task: (client: SqlClient) => Promise<TValue>,
): Promise<TValue> {
  const client = await pool.connect();

  try {
    return await task(new PostgresSqlClient(client));
  } finally {
    client.release();
  }
}

async function withPostgresTransaction<TValue>(
  pool: PostgresPoolLike,
  task: (client: SqlClient) => Promise<TValue>,
): Promise<TValue> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await task(new PostgresSqlClient(client));
    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

async function withSqliteClient<TValue>(
  options: {
    readonly filePath: string;
    readonly mutable: boolean;
  },
  task: (client: SqlClient) => Promise<TValue>,
): Promise<TValue> {
  if (options.mutable) {
    await ensureParentDirectory(options.filePath);
  }

  const SQL = await loadSqliteModule();
  const database = await openSqliteDatabase(SQL, options.filePath);

  try {
    const client = new SqliteSqlClient(database);

    await applyRuntimePersistenceMigrations(client);

    if (!options.mutable) {
      return task(client);
    }

    await client.execute("BEGIN");

    try {
      const result = await task(client);
      await client.execute("COMMIT");
      await writeBinaryFileAtomically(options.filePath, database.export());

      return result;
    } catch (error) {
      await client.execute("ROLLBACK");

      throw error;
    }
  } finally {
    database.close();
  }
}

async function applyRuntimePersistenceMigrations(
  client: SqlClient,
): Promise<void> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS runroot_schema_migrations (
       version TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL
     )`,
  );

  const rows = await client.queryRows<{ version: string }>(
    "SELECT version FROM runroot_schema_migrations ORDER BY version ASC",
  );
  const appliedVersions = new Set(rows.map((row) => row.version));

  for (const migration of getRuntimePersistenceMigrations(client.dialect)) {
    if (appliedVersions.has(migration.id)) {
      continue;
    }

    for (const statement of migration.statements) {
      await client.execute(statement);
    }

    await client.execute(
      `INSERT INTO runroot_schema_migrations (version, applied_at)
       VALUES (?, ?)`,
      [migration.id, new Date().toISOString()],
    );
  }
}

async function openSqliteDatabase(
  SQL: SqlJsStatic,
  filePath: string,
): Promise<SqliteDatabase> {
  try {
    const contents = await readFile(filePath);

    return new SQL.Database(new Uint8Array(contents));
  } catch (error) {
    if (isMissingFileError(error)) {
      return new SQL.Database();
    }

    throw error;
  }
}

async function loadSqliteModule(): Promise<SqlJsStatic> {
  sqliteModulePromise ??= initSqlJs();

  return sqliteModulePromise;
}

async function ensureParentDirectory(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), {
    recursive: true,
  });
}

async function writeBinaryFileAtomically(
  filePath: string,
  contents: Uint8Array,
): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  await writeFile(tempPath, Buffer.from(contents));

  try {
    await rename(tempPath, filePath);

    return;
  } catch (error) {
    if (!isExistingFileError(error)) {
      throw error;
    }
  }

  await rm(backupPath, {
    force: true,
  });

  try {
    await rename(filePath, backupPath);
    await rename(tempPath, filePath);
  } catch (error) {
    await rm(tempPath, {
      force: true,
    });

    try {
      await rename(backupPath, filePath);
    } catch (restoreError) {
      if (!isMissingFileError(restoreError)) {
        throw restoreError;
      }
    }

    throw error;
  }

  await rm(backupPath, {
    force: true,
  });
}

async function withFileLock<TValue>(
  filePath: string,
  options: Pick<
    SqliteDispatchQueueOptions,
    "lockRetryDelayMs" | "lockTimeoutMs"
  >,
  action: () => Promise<TValue>,
): Promise<TValue> {
  const lockPath = `${filePath}.lock`;
  const retryDelayMs = options.lockRetryDelayMs ?? 25;
  const timeoutMs = options.lockTimeoutMs ?? 5_000;
  const startedAt = Date.now();

  while (true) {
    try {
      const lockHandle = await open(lockPath, "wx");

      try {
        return await action();
      } finally {
        await lockHandle.close();
        await rm(lockPath, {
          force: true,
        });
      }
    } catch (error) {
      if (!isExistingFileError(error)) {
        throw error;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(
          `Timed out waiting for dispatch queue lock at "${lockPath}".`,
        );
      }

      await delay(retryDelayMs);
    }
  }
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, durationMs);
  });
}

function toSqliteParams(params: readonly SqlPrimitive[]): BindParams {
  return [...params];
}

function convertQuestionMarksToPostgres(sql: string): string {
  let placeholderIndex = 0;

  return sql.replace(/\?/g, () => `$${++placeholderIndex}`);
}

function serializeRow(value: unknown): string {
  return JSON.stringify(value);
}

function deserializeRow<TValue>(rawValue: string): TValue {
  return JSON.parse(rawValue) as TValue;
}

function clone<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

function isExistingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "EEXIST" || error.code === "EPERM")
  );
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
