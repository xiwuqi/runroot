import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { ApprovalRequest } from "@runroot/approvals";
import {
  type ResolvePersistenceConfigOptions,
  resolvePersistenceConfig,
} from "@runroot/config";
import type { RunId, WorkflowCheckpoint, WorkflowRun } from "@runroot/domain";
import type { RuntimeEvent, RuntimeEventInput } from "@runroot/events";
import type { Pool, PoolClient } from "pg";
import type {
  BindParams,
  Database as SqliteDatabase,
  SqlJsStatic,
} from "sql.js";
import initSqlJs from "sql.js/dist/sql-asm.js";
import { getRuntimePersistenceMigrations } from "./migrations";
import {
  type CheckpointWrite,
  createFileRuntimePersistence,
  createInMemoryRuntimePersistence,
  createRuntimePersistenceSnapshot,
  type FileRuntimePersistenceOptions,
  type RuntimePersistence,
  type RuntimePersistenceSnapshot,
} from "./runtime-store";

type IdGenerator = (prefix: "checkpoint" | "event") => string;
type SqlPrimitive = number | string | null;
type SqlQueryRow = Readonly<Record<string, unknown>>;

interface SqlClient {
  readonly dialect: "postgres" | "sqlite";
  execute(sql: string, params?: readonly SqlPrimitive[]): Promise<void>;
  queryRows<TRow extends SqlQueryRow>(
    sql: string,
    params?: readonly SqlPrimitive[],
  ): Promise<readonly TRow[]>;
}

type PostgresPoolLike = Pick<Pool, "connect">;

export interface PostgresRuntimePersistenceOptions {
  readonly databaseUrl?: string;
  readonly idGenerator?: IdGenerator;
  readonly pool?: PostgresPoolLike;
}

export interface SqliteRuntimePersistenceOptions {
  readonly filePath: string;
  readonly idGenerator?: IdGenerator;
  readonly lockRetryDelayMs?: number;
  readonly lockTimeoutMs?: number;
}

export interface ConfiguredRuntimePersistenceOptions
  extends ResolvePersistenceConfigOptions {
  readonly idGenerator?: IdGenerator;
  readonly lockRetryDelayMs?: number;
  readonly lockTimeoutMs?: number;
  readonly pool?: PostgresPoolLike;
}

export interface MigrationResult {
  readonly appliedVersions: readonly string[];
  readonly dialect: "postgres" | "sqlite";
  readonly location: string;
}

const defaultIdGenerator: IdGenerator = (prefix) => `${prefix}_${randomUUID()}`;
let sqliteModulePromise: Promise<SqlJsStatic> | undefined;

export function createConfiguredRuntimePersistence(
  options: ConfiguredRuntimePersistenceOptions = {},
): RuntimePersistence {
  const resolved = resolvePersistenceConfig(options);

  switch (resolved.driver) {
    case "file":
      return createFileRuntimePersistence({
        filePath: resolved.workspacePath ?? resolved.location,
        ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
        ...(options.lockRetryDelayMs !== undefined
          ? { lockRetryDelayMs: options.lockRetryDelayMs }
          : {}),
        ...(options.lockTimeoutMs !== undefined
          ? { lockTimeoutMs: options.lockTimeoutMs }
          : {}),
      });
    case "postgres":
      return createPostgresRuntimePersistence({
        ...(resolved.databaseUrl ? { databaseUrl: resolved.databaseUrl } : {}),
        ...(options.idGenerator ? { idGenerator: options.idGenerator } : {}),
        ...(options.pool ? { pool: options.pool } : {}),
      });
    case "sqlite":
      return createSqliteRuntimePersistence({
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

export function createPostgresRuntimePersistence(
  options: PostgresRuntimePersistenceOptions = {},
): RuntimePersistence {
  const idGenerator = options.idGenerator ?? defaultIdGenerator;
  const pool = options.pool ?? createDefaultPool(options.databaseUrl);
  let schemaReadyPromise: Promise<void> | undefined;

  return createDatabaseRuntimePersistence({
    ensureSchema() {
      schemaReadyPromise ??= migratePostgresPersistence({
        ...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
        ...(options.pool ? { pool: options.pool } : {}),
      }).then(() => undefined);

      return schemaReadyPromise;
    },
    withReadOnlyClient(task) {
      return withPostgresClient(pool, task);
    },
    withTransaction(task) {
      return withPostgresTransaction(pool, task);
    },
    idGenerator,
  });
}

export function createSqliteRuntimePersistence(
  options: SqliteRuntimePersistenceOptions,
): RuntimePersistence {
  const filePath = resolve(options.filePath);
  const idGenerator = options.idGenerator ?? defaultIdGenerator;
  let accessQueue = Promise.resolve();

  return createDatabaseRuntimePersistence({
    ensureSchema() {
      return Promise.resolve();
    },
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
    idGenerator,
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

export async function migratePostgresPersistence(
  options: PostgresRuntimePersistenceOptions = {},
): Promise<MigrationResult> {
  const pool = options.pool ?? createDefaultPool(options.databaseUrl);
  const appliedVersions = await withPostgresTransaction(pool, async (client) =>
    applyRuntimePersistenceMigrations(client),
  );

  return {
    appliedVersions,
    dialect: "postgres",
    location: options.databaseUrl ?? "postgres://configured-pool",
  };
}

export async function migrateSqlitePersistence(
  options: Pick<SqliteRuntimePersistenceOptions, "filePath">,
): Promise<MigrationResult> {
  const filePath = resolve(options.filePath);
  const appliedVersions: readonly string[] = await withFileLock(
    filePath,
    {},
    async () => {
      await ensureParentDirectory(filePath);

      const SQL = await loadSqliteModule();
      const database = await openSqliteDatabase(SQL, filePath);

      try {
        const client = new SqliteSqlClient(database);
        const nextAppliedVersions =
          await applyRuntimePersistenceMigrations(client);

        await writeBinaryFileAtomically(filePath, database.export());

        return nextAppliedVersions;
      } finally {
        database.close();
      }
    },
  );

  return {
    appliedVersions,
    dialect: "sqlite",
    location: filePath,
  };
}

function createDatabaseRuntimePersistence(options: {
  readonly ensureSchema: () => Promise<void>;
  readonly idGenerator: IdGenerator;
  readonly withReadOnlyClient: <TValue>(
    task: (client: SqlClient) => Promise<TValue>,
  ) => Promise<TValue>;
  readonly withTransaction: <TValue>(
    task: (client: SqlClient) => Promise<TValue>,
  ) => Promise<TValue>;
}): RuntimePersistence {
  return {
    async commitTransition(transition) {
      await options.ensureSchema();

      return options.withTransaction(async (client) => {
        const snapshot = await readRunSnapshot(client, transition.run.id);
        const persistence = createInMemoryRuntimePersistence({
          idGenerator: options.idGenerator,
          snapshot,
        });
        const result = await persistence.commitTransition(transition);
        const nextSnapshot =
          await createRuntimePersistenceSnapshot(persistence);

        await writeRunSnapshot(client, transition.run.id, nextSnapshot);

        return result;
      });
    },

    approvals: {
      async get(approvalId) {
        await options.ensureSchema();

        return options.withReadOnlyClient(async (client) => {
          const rows = await client.queryRows<{ data: string }>(
            "SELECT data FROM runroot_approvals WHERE id = ?",
            [approvalId],
          );

          return rows[0]
            ? deserializeRow<ApprovalRequest>(rows[0].data)
            : undefined;
        });
      },

      async getPendingByRunId(runId) {
        await options.ensureSchema();

        return options.withReadOnlyClient(async (client) => {
          const rows = await client.queryRows<{ data: string }>(
            `SELECT data
             FROM runroot_approvals
             WHERE run_id = ? AND status = ?
             ORDER BY requested_at ASC, id ASC
             LIMIT 1`,
            [runId, "pending"],
          );

          return rows[0]
            ? deserializeRow<ApprovalRequest>(rows[0].data)
            : undefined;
        });
      },

      async listByRunId(runId) {
        await options.ensureSchema();

        return options.withReadOnlyClient(async (client) => {
          const rows = await client.queryRows<{ data: string }>(
            `SELECT data
             FROM runroot_approvals
             WHERE run_id = ?
             ORDER BY requested_at ASC, id ASC`,
            [runId],
          );

          return rows.map((row) => deserializeRow<ApprovalRequest>(row.data));
        });
      },
    },

    checkpoints: {
      async getLatestByRunId(runId) {
        await options.ensureSchema();

        return options.withReadOnlyClient(async (client) => {
          const rows = await client.queryRows<{ data: string }>(
            `SELECT data
             FROM runroot_checkpoints
             WHERE run_id = ?
             ORDER BY sequence DESC
             LIMIT 1`,
            [runId],
          );

          return rows[0]
            ? deserializeRow<WorkflowCheckpoint>(rows[0].data)
            : undefined;
        });
      },

      async listByRunId(runId) {
        await options.ensureSchema();

        return options.withReadOnlyClient(async (client) => {
          const rows = await client.queryRows<{ data: string }>(
            `SELECT data
             FROM runroot_checkpoints
             WHERE run_id = ?
             ORDER BY sequence ASC`,
            [runId],
          );

          return rows.map((row) =>
            deserializeRow<WorkflowCheckpoint>(row.data),
          );
        });
      },

      async save(checkpoint) {
        await options.ensureSchema();

        return options.withTransaction(async (client) => {
          const sequence =
            (await readCurrentSequence(
              client,
              "runroot_checkpoints",
              checkpoint.runId,
            )) + 1;
          const persistedCheckpoint = createPersistedCheckpoint(
            checkpoint,
            sequence,
            options.idGenerator,
          );

          await client.execute(
            `INSERT INTO runroot_checkpoints (
               id,
               run_id,
               sequence,
               created_at,
               data
             ) VALUES (?, ?, ?, ?, ?)`,
            [
              persistedCheckpoint.id,
              persistedCheckpoint.runId,
              persistedCheckpoint.sequence,
              persistedCheckpoint.createdAt,
              serializeRow(persistedCheckpoint),
            ],
          );

          return clone(persistedCheckpoint);
        });
      },
    },

    events: {
      async append(nextEvents) {
        await options.ensureSchema();

        return options.withTransaction(async (client) => {
          const nextSequenceByRun = new Map<RunId, number>();
          const persistedEvents: RuntimeEvent[] = [];

          for (const nextEvent of nextEvents) {
            const previousSequence =
              nextSequenceByRun.get(nextEvent.runId) ??
              (await readCurrentSequence(
                client,
                "runroot_events",
                nextEvent.runId,
              ));
            const persistedEvent = createPersistedEvent(
              nextEvent,
              previousSequence + 1,
              options.idGenerator,
            );

            nextSequenceByRun.set(nextEvent.runId, persistedEvent.sequence);
            await client.execute(
              `INSERT INTO runroot_events (
                 id,
                 run_id,
                 sequence,
                 occurred_at,
                 name,
                 step_id,
                 data
               ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                persistedEvent.id,
                persistedEvent.runId,
                persistedEvent.sequence,
                persistedEvent.occurredAt,
                persistedEvent.name,
                persistedEvent.stepId ?? null,
                serializeRow(persistedEvent),
              ],
            );
            persistedEvents.push(persistedEvent);
          }

          return persistedEvents.map((event) => clone(event));
        });
      },

      async listByRunId(runId) {
        await options.ensureSchema();

        return options.withReadOnlyClient(async (client) => {
          const rows = await client.queryRows<{ data: string }>(
            `SELECT data
             FROM runroot_events
             WHERE run_id = ?
             ORDER BY sequence ASC`,
            [runId],
          );

          return rows.map((row) => deserializeRow<RuntimeEvent>(row.data));
        });
      },
    },

    runs: {
      async get(runId) {
        await options.ensureSchema();

        return options.withReadOnlyClient(async (client) => {
          const rows = await client.queryRows<{ data: string }>(
            "SELECT data FROM runroot_runs WHERE id = ?",
            [runId],
          );

          return rows[0]
            ? deserializeRow<WorkflowRun>(rows[0].data)
            : undefined;
        });
      },

      async list() {
        await options.ensureSchema();

        return options.withReadOnlyClient(async (client) => {
          const rows = await client.queryRows<{ data: string }>(
            `SELECT data
             FROM runroot_runs
             ORDER BY created_at ASC, id ASC`,
          );

          return rows.map((row) => deserializeRow<WorkflowRun>(row.data));
        });
      },

      async put(run) {
        await options.ensureSchema();

        return options.withTransaction(async (client) => {
          await upsertRun(client, run);

          return clone(run);
        });
      },
    },
  };
}

async function readRunSnapshot(
  client: SqlClient,
  runId: RunId,
): Promise<RuntimePersistenceSnapshot> {
  const [runRows, approvalRows, checkpointRows, eventRows] = await Promise.all([
    client.queryRows<{ data: string }>(
      "SELECT data FROM runroot_runs WHERE id = ?",
      [runId],
    ),
    client.queryRows<{ data: string }>(
      `SELECT data
       FROM runroot_approvals
       WHERE run_id = ?
       ORDER BY requested_at ASC, id ASC`,
      [runId],
    ),
    client.queryRows<{ data: string }>(
      `SELECT data
       FROM runroot_checkpoints
       WHERE run_id = ?
       ORDER BY sequence ASC`,
      [runId],
    ),
    client.queryRows<{ data: string }>(
      `SELECT data
       FROM runroot_events
       WHERE run_id = ?
       ORDER BY sequence ASC`,
      [runId],
    ),
  ]);

  return {
    approvals: approvalRows.map((row) =>
      deserializeRow<ApprovalRequest>(row.data),
    ),
    checkpoints: checkpointRows.map((row) =>
      deserializeRow<WorkflowCheckpoint>(row.data),
    ),
    events: eventRows.map((row) => deserializeRow<RuntimeEvent>(row.data)),
    runs: runRows.map((row) => deserializeRow<WorkflowRun>(row.data)),
  };
}

async function writeRunSnapshot(
  client: SqlClient,
  runId: RunId,
  snapshot: RuntimePersistenceSnapshot,
): Promise<void> {
  await client.execute("DELETE FROM runroot_events WHERE run_id = ?", [runId]);
  await client.execute("DELETE FROM runroot_checkpoints WHERE run_id = ?", [
    runId,
  ]);
  await client.execute("DELETE FROM runroot_approvals WHERE run_id = ?", [
    runId,
  ]);
  await client.execute("DELETE FROM runroot_runs WHERE id = ?", [runId]);

  const run = snapshot.runs.find((candidate) => candidate.id === runId);

  if (!run) {
    return;
  }

  await upsertRun(client, run);

  for (const approval of snapshot.approvals.filter(
    (candidate) => candidate.runId === runId,
  )) {
    await client.execute(
      `INSERT INTO runroot_approvals (
         id,
         run_id,
         requested_at,
         status,
         data
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        approval.id,
        approval.runId,
        approval.requestedAt,
        approval.status,
        serializeRow(approval),
      ],
    );
  }

  for (const checkpoint of snapshot.checkpoints.filter(
    (candidate) => candidate.runId === runId,
  )) {
    await client.execute(
      `INSERT INTO runroot_checkpoints (
         id,
         run_id,
         sequence,
         created_at,
         data
       ) VALUES (?, ?, ?, ?, ?)`,
      [
        checkpoint.id,
        checkpoint.runId,
        checkpoint.sequence,
        checkpoint.createdAt,
        serializeRow(checkpoint),
      ],
    );
  }

  for (const event of snapshot.events.filter(
    (candidate) => candidate.runId === runId,
  )) {
    await client.execute(
      `INSERT INTO runroot_events (
         id,
         run_id,
         sequence,
         occurred_at,
         name,
         step_id,
         data
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.runId,
        event.sequence,
        event.occurredAt,
        event.name,
        event.stepId ?? null,
        serializeRow(event),
      ],
    );
  }
}

async function upsertRun(client: SqlClient, run: WorkflowRun): Promise<void> {
  await client.execute(
    `INSERT INTO runroot_runs (
       id,
       created_at,
       updated_at,
       status,
       definition_id,
       definition_name,
       data
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       status = excluded.status,
       definition_id = excluded.definition_id,
       definition_name = excluded.definition_name,
       data = excluded.data`,
    [
      run.id,
      run.createdAt,
      run.updatedAt,
      run.status,
      run.definitionId,
      run.definitionName,
      serializeRow(run),
    ],
  );
}

async function readCurrentSequence(
  client: SqlClient,
  tableName: "runroot_checkpoints" | "runroot_events",
  runId: RunId,
): Promise<number> {
  const rows = await client.queryRows<{ sequence: number | string | null }>(
    `SELECT COALESCE(MAX(sequence), 0) AS sequence
     FROM ${tableName}
     WHERE run_id = ?`,
    [runId],
  );

  return rows[0] ? parseInteger(rows[0].sequence) : 0;
}

async function applyRuntimePersistenceMigrations(
  client: SqlClient,
): Promise<readonly string[]> {
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
  const newlyApplied: string[] = [];

  for (const migration of getMigrationsForDialect(client.dialect)) {
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
    newlyApplied.push(migration.id);
  }

  return newlyApplied;
}

function getMigrationsForDialect(dialect: "postgres" | "sqlite") {
  return getRuntimePersistenceMigrations(dialect);
}

function createDefaultPool(databaseUrl?: string): PostgresPoolLike {
  if (!databaseUrl) {
    throw new Error(
      'Postgres persistence requires DATABASE_URL or an explicit "databaseUrl" option.',
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

class PostgresSqlClient implements SqlClient {
  readonly dialect = "postgres" as const;

  constructor(private readonly client: PoolClient) {}

  async execute(
    sql: string,
    params: readonly SqlPrimitive[] = [],
  ): Promise<void> {
    await this.client.query(convertQuestionMarksToPostgres(sql), [...params]);
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
  ): Promise<void> {
    this.database.run(sql, toSqliteParams(params));
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

function toSqliteParams(params: readonly SqlPrimitive[]): BindParams {
  return [...params];
}

function convertQuestionMarksToPostgres(sql: string): string {
  let placeholderIndex = 0;

  return sql.replace(/\?/g, () => `$${++placeholderIndex}`);
}

function parseInteger(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return 0;
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

function createPersistedCheckpoint(
  checkpoint: CheckpointWrite,
  sequence: number,
  generateId: IdGenerator,
): WorkflowCheckpoint {
  return {
    attempt: checkpoint.attempt,
    createdAt: checkpoint.createdAt,
    id: checkpoint.id ?? generateId("checkpoint"),
    nextStepIndex: checkpoint.nextStepIndex,
    ...(checkpoint.payload === undefined
      ? {}
      : { payload: checkpoint.payload }),
    reason: checkpoint.reason,
    runId: checkpoint.runId,
    sequence,
    ...(checkpoint.stepId ? { stepId: checkpoint.stepId } : {}),
  };
}

function createPersistedEvent<TEventName extends RuntimeEventInput["name"]>(
  nextEvent: RuntimeEventInput<TEventName>,
  sequence: number,
  generateId: IdGenerator,
): RuntimeEvent<TEventName> {
  const baseEvent = {
    id: generateId("event"),
    name: nextEvent.name,
    occurredAt: nextEvent.occurredAt,
    payload: clone(nextEvent.payload),
    runId: nextEvent.runId,
    sequence,
  };

  if (!nextEvent.stepId) {
    return baseEvent;
  }

  return {
    ...baseEvent,
    stepId: nextEvent.stepId,
  };
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
    FileRuntimePersistenceOptions,
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
          `Timed out waiting for runtime persistence lock at "${lockPath}".`,
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
