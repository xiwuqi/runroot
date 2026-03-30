import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import {
  type ResolvePersistenceConfigOptions,
  resolvePersistenceConfig,
} from "@runroot/config";
import type {
  CrossRunAuditCatalogVisibility,
  CrossRunAuditCatalogVisibilityStore,
} from "@runroot/replay";
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

export interface InMemoryAuditCatalogVisibilityStoreOptions {
  readonly visibility?: readonly CrossRunAuditCatalogVisibility[];
}

export interface FileAuditCatalogVisibilityStoreOptions {
  readonly filePath: string;
  readonly lockRetryDelayMs?: number;
  readonly lockTimeoutMs?: number;
}

export interface PostgresAuditCatalogVisibilityStoreOptions
  extends Pick<PostgresRuntimePersistenceOptions, "databaseUrl" | "pool"> {}

export interface SqliteAuditCatalogVisibilityStoreOptions
  extends Pick<
    SqliteRuntimePersistenceOptions,
    "filePath" | "lockRetryDelayMs" | "lockTimeoutMs"
  > {}

export interface ConfiguredAuditCatalogVisibilityStoreOptions
  extends ResolvePersistenceConfigOptions {
  readonly filePath?: string;
  readonly lockRetryDelayMs?: number;
  readonly lockTimeoutMs?: number;
  readonly pool?: PostgresPoolLike;
}

interface AuditCatalogVisibilitySnapshot {
  readonly visibility: readonly CrossRunAuditCatalogVisibility[];
}

let sqliteModulePromise: Promise<SqlJsStatic> | undefined;

export function createConfiguredAuditCatalogVisibilityStore(
  options: ConfiguredAuditCatalogVisibilityStoreOptions = {},
): CrossRunAuditCatalogVisibilityStore {
  const resolved = resolvePersistenceConfig(options);

  switch (resolved.driver) {
    case "file":
      return createFileAuditCatalogVisibilityStore({
        filePath:
          options.filePath ??
          resolveAuditCatalogVisibilityFilePath(
            resolved.workspacePath ?? resolved.location,
          ),
        ...(options.lockRetryDelayMs !== undefined
          ? { lockRetryDelayMs: options.lockRetryDelayMs }
          : {}),
        ...(options.lockTimeoutMs !== undefined
          ? { lockTimeoutMs: options.lockTimeoutMs }
          : {}),
      });
    case "postgres":
      return createPostgresAuditCatalogVisibilityStore({
        ...(resolved.databaseUrl ? { databaseUrl: resolved.databaseUrl } : {}),
        ...(options.pool ? { pool: options.pool } : {}),
      });
    case "sqlite":
      return createSqliteAuditCatalogVisibilityStore({
        filePath: resolved.sqlitePath ?? resolved.location,
        ...(options.lockRetryDelayMs !== undefined
          ? { lockRetryDelayMs: options.lockRetryDelayMs }
          : {}),
        ...(options.lockTimeoutMs !== undefined
          ? { lockTimeoutMs: options.lockTimeoutMs }
          : {}),
      });
  }
}

export function createInMemoryAuditCatalogVisibilityStore(
  options: InMemoryAuditCatalogVisibilityStoreOptions = {},
): CrossRunAuditCatalogVisibilityStore {
  const visibility = [...(options.visibility ?? [])].map((entry) =>
    clone(entry),
  );

  return {
    async getCatalogVisibility(catalogEntryId) {
      const entry = visibility.find(
        (candidate) => candidate.catalogEntryId === catalogEntryId,
      );

      return entry ? clone(entry) : undefined;
    },

    async listCatalogVisibility() {
      return visibility.map((entry) => clone(entry));
    },

    async saveCatalogVisibility(entry) {
      const existingIndex = visibility.findIndex(
        (candidate) => candidate.catalogEntryId === entry.catalogEntryId,
      );

      if (existingIndex >= 0) {
        visibility.splice(existingIndex, 1);
      }

      visibility.push(clone(entry));

      return clone(entry);
    },
  };
}

export function createFileAuditCatalogVisibilityStore(
  options: FileAuditCatalogVisibilityStoreOptions,
): CrossRunAuditCatalogVisibilityStore {
  const filePath = resolve(options.filePath);
  let accessQueue = Promise.resolve();

  return {
    async getCatalogVisibility(catalogEntryId) {
      return enqueueAccess(async () =>
        withReadOnlySnapshot(filePath, (snapshot) => {
          const entry = snapshot.visibility.find(
            (candidate) => candidate.catalogEntryId === catalogEntryId,
          );

          return entry ? clone(entry) : undefined;
        }),
      );
    },

    async listCatalogVisibility() {
      return enqueueAccess(async () =>
        withReadOnlySnapshot(filePath, (snapshot) =>
          snapshot.visibility.map((entry) => clone(entry)),
        ),
      );
    },

    async saveCatalogVisibility(entry) {
      return enqueueAccess(async () =>
        withMutableSnapshot(filePath, options, async (snapshot) => {
          const nextVisibility = [
            ...snapshot.visibility.filter(
              (candidate) => candidate.catalogEntryId !== entry.catalogEntryId,
            ),
            clone(entry),
          ];

          await writeAuditCatalogVisibilitySnapshot(filePath, {
            visibility: nextVisibility,
          });

          return clone(entry);
        }),
      );
    },
  };

  async function enqueueAccess<TValue>(
    accessOperation: () => Promise<TValue>,
  ): Promise<TValue> {
    const pendingAccess = accessQueue.then(accessOperation, accessOperation);
    accessQueue = pendingAccess.then(
      () => undefined,
      () => undefined,
    );

    return pendingAccess;
  }
}

export function createPostgresAuditCatalogVisibilityStore(
  options: PostgresAuditCatalogVisibilityStoreOptions = {},
): CrossRunAuditCatalogVisibilityStore {
  const pool = options.pool ?? createDefaultPool(options.databaseUrl);
  let schemaReadyPromise: Promise<void> | undefined;

  return createDatabaseAuditCatalogVisibilityStore({
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
  });
}

export function createSqliteAuditCatalogVisibilityStore(
  options: SqliteAuditCatalogVisibilityStoreOptions,
): CrossRunAuditCatalogVisibilityStore {
  const filePath = resolve(options.filePath);
  let accessQueue = Promise.resolve();
  let schemaReadyPromise: Promise<void> | undefined;

  return createDatabaseAuditCatalogVisibilityStore({
    ensureSchema() {
      schemaReadyPromise ??= migrateSqlitePersistence({
        filePath,
      }).then(() => undefined);

      return schemaReadyPromise;
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

function createDatabaseAuditCatalogVisibilityStore(options: {
  readonly ensureSchema: () => Promise<void>;
  readonly withReadOnlyClient: <TValue>(
    task: (client: SqlClient) => Promise<TValue>,
  ) => Promise<TValue>;
  readonly withTransaction: <TValue>(
    task: (client: SqlClient) => Promise<TValue>,
  ) => Promise<TValue>;
}): CrossRunAuditCatalogVisibilityStore {
  return {
    async getCatalogVisibility(catalogEntryId) {
      await options.ensureSchema();

      return options.withReadOnlyClient(async (client) => {
        const rows = await client.queryRows<{ data: string }>(
          `SELECT data
           FROM runroot_audit_catalog_visibility
           WHERE catalog_entry_id = ?`,
          [catalogEntryId],
        );

        return rows[0]
          ? deserializeRow<CrossRunAuditCatalogVisibility>(rows[0].data)
          : undefined;
      });
    },

    async listCatalogVisibility() {
      await options.ensureSchema();

      return options.withReadOnlyClient(async (client) => {
        const rows = await client.queryRows<{ data: string }>(
          `SELECT data
           FROM runroot_audit_catalog_visibility`,
        );

        return rows.map((row) =>
          deserializeRow<CrossRunAuditCatalogVisibility>(row.data),
        );
      });
    },

    async saveCatalogVisibility(entry) {
      await options.ensureSchema();

      return options.withTransaction(async (client) => {
        await client.execute(
          `INSERT INTO runroot_audit_catalog_visibility (
             catalog_entry_id,
             kind,
             owner_id,
             scope_id,
             visibility_state,
             created_at,
             updated_at,
             data
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (catalog_entry_id) DO UPDATE SET
             kind = excluded.kind,
             owner_id = excluded.owner_id,
             scope_id = excluded.scope_id,
             visibility_state = excluded.visibility_state,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             data = excluded.data`,
          [
            entry.catalogEntryId,
            entry.kind,
            entry.ownerId,
            entry.scopeId,
            entry.state,
            entry.createdAt,
            entry.updatedAt,
            serializeRow(entry),
          ],
        );

        return clone(entry);
      });
    },
  };
}

export function resolveAuditCatalogVisibilityFilePath(
  workspacePath: string,
): string {
  const resolvedPath = resolve(workspacePath);
  const parsedPath = parse(resolvedPath);

  return join(
    parsedPath.dir,
    `${parsedPath.name}.audit-catalog-visibility.json`,
  );
}

async function withReadOnlySnapshot<TValue>(
  filePath: string,
  action: (
    snapshot: AuditCatalogVisibilitySnapshot,
  ) => TValue | Promise<TValue>,
): Promise<TValue> {
  const snapshot = await readAuditCatalogVisibilitySnapshot(filePath);

  return action(snapshot);
}

async function withMutableSnapshot<TValue>(
  filePath: string,
  options: Pick<
    FileAuditCatalogVisibilityStoreOptions,
    "lockRetryDelayMs" | "lockTimeoutMs"
  >,
  action: (snapshot: AuditCatalogVisibilitySnapshot) => Promise<TValue>,
): Promise<TValue> {
  await ensureParentDirectory(filePath);

  return withFileLock(filePath, options, async () =>
    action(await readAuditCatalogVisibilitySnapshot(filePath)),
  );
}

async function readAuditCatalogVisibilitySnapshot(
  filePath: string,
): Promise<AuditCatalogVisibilitySnapshot> {
  try {
    const rawSnapshot = await readFile(filePath, "utf8");
    const parsedSnapshot = JSON.parse(
      rawSnapshot,
    ) as AuditCatalogVisibilitySnapshot;

    return {
      visibility: [...(parsedSnapshot.visibility ?? [])].map((entry) =>
        clone(entry),
      ),
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        visibility: [],
      };
    }

    throw error;
  }
}

async function writeAuditCatalogVisibilitySnapshot(
  filePath: string,
  snapshot: AuditCatalogVisibilitySnapshot,
): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  const backupPath = `${filePath}.bak`;

  await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

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
      'Postgres audit catalog visibility requires DATABASE_URL or an explicit "databaseUrl" option.',
    );
  }

  const { Pool } = require("pg") as typeof import("pg");

  return new Pool({
    connectionString: databaseUrl,
  });
}

function toSqliteParams(params: readonly SqlPrimitive[]): BindParams {
  return [...params];
}

function convertQuestionMarksToPostgres(sql: string): string {
  let placeholderIndex = 0;

  return sql.replace(/\?/g, () => `$${++placeholderIndex}`);
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
    | FileAuditCatalogVisibilityStoreOptions
    | SqliteAuditCatalogVisibilityStoreOptions,
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
          `Timed out waiting for audit catalog visibility lock at "${lockPath}".`,
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
