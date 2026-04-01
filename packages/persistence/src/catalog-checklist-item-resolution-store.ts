import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import {
  type ResolvePersistenceConfigOptions,
  resolvePersistenceConfig,
} from "@runroot/config";
import type {
  CrossRunAuditCatalogChecklistItemResolution,
  CrossRunAuditCatalogChecklistItemResolutionStore,
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

export interface InMemoryAuditCatalogChecklistItemResolutionStoreOptions {
  readonly resolutionEntries?: readonly CrossRunAuditCatalogChecklistItemResolution[];
}

export interface FileAuditCatalogChecklistItemResolutionStoreOptions {
  readonly filePath: string;
  readonly lockRetryDelayMs?: number;
  readonly lockTimeoutMs?: number;
}

export interface PostgresAuditCatalogChecklistItemResolutionStoreOptions
  extends Pick<PostgresRuntimePersistenceOptions, "databaseUrl" | "pool"> {}

export interface SqliteAuditCatalogChecklistItemResolutionStoreOptions
  extends Pick<
    SqliteRuntimePersistenceOptions,
    "filePath" | "lockRetryDelayMs" | "lockTimeoutMs"
  > {}

export interface ConfiguredAuditCatalogChecklistItemResolutionStoreOptions
  extends ResolvePersistenceConfigOptions {
  readonly filePath?: string;
  readonly lockRetryDelayMs?: number;
  readonly lockTimeoutMs?: number;
  readonly pool?: PostgresPoolLike;
}

interface AuditCatalogChecklistItemResolutionSnapshot {
  readonly resolutionEntries: readonly CrossRunAuditCatalogChecklistItemResolution[];
}

let sqliteModulePromise: Promise<SqlJsStatic> | undefined;

export function createConfiguredAuditCatalogChecklistItemResolutionStore(
  options: ConfiguredAuditCatalogChecklistItemResolutionStoreOptions = {},
): CrossRunAuditCatalogChecklistItemResolutionStore {
  const resolved = resolvePersistenceConfig(options);

  switch (resolved.driver) {
    case "file":
      return createFileAuditCatalogChecklistItemResolutionStore({
        filePath:
          options.filePath ??
          resolveAuditCatalogChecklistItemResolutionsFilePath(
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
      return createPostgresAuditCatalogChecklistItemResolutionStore({
        ...(resolved.databaseUrl ? { databaseUrl: resolved.databaseUrl } : {}),
        ...(options.pool ? { pool: options.pool } : {}),
      });
    case "sqlite":
      return createSqliteAuditCatalogChecklistItemResolutionStore({
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

export function createInMemoryAuditCatalogChecklistItemResolutionStore(
  options: InMemoryAuditCatalogChecklistItemResolutionStoreOptions = {},
): CrossRunAuditCatalogChecklistItemResolutionStore {
  const resolutionEntries = [...(options.resolutionEntries ?? [])].map(
    (entry) => clone(entry),
  );

  return {
    async deleteCatalogChecklistItemResolution(catalogEntryId) {
      const existingIndex = resolutionEntries.findIndex(
        (entry) => entry.catalogEntryId === catalogEntryId,
      );

      if (existingIndex < 0) {
        return undefined;
      }

      const [deletedEntry] = resolutionEntries.splice(existingIndex, 1);

      return deletedEntry ? clone(deletedEntry) : undefined;
    },

    async getCatalogChecklistItemResolution(catalogEntryId) {
      const resolution = resolutionEntries.find(
        (entry) => entry.catalogEntryId === catalogEntryId,
      );

      return resolution ? clone(resolution) : undefined;
    },

    async listCatalogChecklistItemResolutions() {
      return resolutionEntries
        .slice()
        .sort(compareCatalogChecklistItemResolutions)
        .map((entry) => clone(entry));
    },

    async saveCatalogChecklistItemResolution(entry) {
      const existingIndex = resolutionEntries.findIndex(
        (candidate) => candidate.catalogEntryId === entry.catalogEntryId,
      );

      if (existingIndex >= 0) {
        resolutionEntries.splice(existingIndex, 1);
      }

      resolutionEntries.push(clone(entry));
      resolutionEntries.sort(compareCatalogChecklistItemResolutions);

      return clone(entry);
    },
  };
}

export function createFileAuditCatalogChecklistItemResolutionStore(
  options: FileAuditCatalogChecklistItemResolutionStoreOptions,
): CrossRunAuditCatalogChecklistItemResolutionStore {
  const filePath = resolve(options.filePath);
  let accessQueue = Promise.resolve();

  return {
    async deleteCatalogChecklistItemResolution(catalogEntryId) {
      return enqueueAccess(async () =>
        withMutableSnapshot(filePath, options, async (snapshot) => {
          const existingEntry = snapshot.resolutionEntries.find(
            (entry) => entry.catalogEntryId === catalogEntryId,
          );

          if (!existingEntry) {
            return undefined;
          }

          await writeAuditCatalogChecklistItemResolutionSnapshot(filePath, {
            resolutionEntries: snapshot.resolutionEntries.filter(
              (entry) => entry.catalogEntryId !== catalogEntryId,
            ),
          });

          return clone(existingEntry);
        }),
      );
    },

    async getCatalogChecklistItemResolution(catalogEntryId) {
      return enqueueAccess(async () =>
        withReadOnlySnapshot(filePath, (snapshot) => {
          const resolution = snapshot.resolutionEntries.find(
            (entry) => entry.catalogEntryId === catalogEntryId,
          );

          return resolution ? clone(resolution) : undefined;
        }),
      );
    },

    async listCatalogChecklistItemResolutions() {
      return enqueueAccess(async () =>
        withReadOnlySnapshot(filePath, (snapshot) =>
          snapshot.resolutionEntries
            .slice()
            .sort(compareCatalogChecklistItemResolutions)
            .map((entry) => clone(entry)),
        ),
      );
    },

    async saveCatalogChecklistItemResolution(entry) {
      return enqueueAccess(async () =>
        withMutableSnapshot(filePath, options, async (snapshot) => {
          const nextResolutionEntries = [
            ...snapshot.resolutionEntries.filter(
              (candidate) => candidate.catalogEntryId !== entry.catalogEntryId,
            ),
            clone(entry),
          ].sort(compareCatalogChecklistItemResolutions);

          await writeAuditCatalogChecklistItemResolutionSnapshot(filePath, {
            resolutionEntries: nextResolutionEntries,
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

export function createPostgresAuditCatalogChecklistItemResolutionStore(
  options: PostgresAuditCatalogChecklistItemResolutionStoreOptions = {},
): CrossRunAuditCatalogChecklistItemResolutionStore {
  const pool = options.pool ?? createDefaultPool(options.databaseUrl);
  let schemaReadyPromise: Promise<void> | undefined;

  return createDatabaseAuditCatalogChecklistItemResolutionStore({
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

export function createSqliteAuditCatalogChecklistItemResolutionStore(
  options: SqliteAuditCatalogChecklistItemResolutionStoreOptions,
): CrossRunAuditCatalogChecklistItemResolutionStore {
  const filePath = resolve(options.filePath);
  let accessQueue = Promise.resolve();
  let schemaReadyPromise: Promise<void> | undefined;

  return createDatabaseAuditCatalogChecklistItemResolutionStore({
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

function createDatabaseAuditCatalogChecklistItemResolutionStore(options: {
  readonly ensureSchema: () => Promise<void>;
  readonly withReadOnlyClient: <TValue>(
    task: (client: SqlClient) => Promise<TValue>,
  ) => Promise<TValue>;
  readonly withTransaction: <TValue>(
    task: (client: SqlClient) => Promise<TValue>,
  ) => Promise<TValue>;
}): CrossRunAuditCatalogChecklistItemResolutionStore {
  return {
    async deleteCatalogChecklistItemResolution(catalogEntryId) {
      await options.ensureSchema();

      return options.withTransaction(async (client) => {
        const existingRows = await client.queryRows<{ data: string }>(
          `SELECT data
           FROM runroot_audit_catalog_checklist_item_resolutions
           WHERE catalog_entry_id = ?`,
          [catalogEntryId],
        );

        if (!existingRows[0]) {
          return undefined;
        }

        await client.execute(
          `DELETE FROM runroot_audit_catalog_checklist_item_resolutions
           WHERE catalog_entry_id = ?`,
          [catalogEntryId],
        );

        return deserializeRow<CrossRunAuditCatalogChecklistItemResolution>(
          existingRows[0].data,
        );
      });
    },

    async getCatalogChecklistItemResolution(catalogEntryId) {
      await options.ensureSchema();

      return options.withReadOnlyClient(async (client) => {
        const rows = await client.queryRows<{ data: string }>(
          `SELECT data
           FROM runroot_audit_catalog_checklist_item_resolutions
           WHERE catalog_entry_id = ?`,
          [catalogEntryId],
        );

        return rows[0]
          ? deserializeRow<CrossRunAuditCatalogChecklistItemResolution>(
              rows[0].data,
            )
          : undefined;
      });
    },

    async listCatalogChecklistItemResolutions() {
      await options.ensureSchema();

      return options.withReadOnlyClient(async (client) => {
        const rows = await client.queryRows<{ data: string }>(
          `SELECT data
           FROM runroot_audit_catalog_checklist_item_resolutions`,
        );

        return rows
          .map((row) =>
            deserializeRow<CrossRunAuditCatalogChecklistItemResolution>(
              row.data,
            ),
          )
          .sort(compareCatalogChecklistItemResolutions);
      });
    },

    async saveCatalogChecklistItemResolution(entry) {
      await options.ensureSchema();

      return options.withTransaction(async (client) => {
        await client.execute(
          `INSERT INTO runroot_audit_catalog_checklist_item_resolutions (
             catalog_entry_id,
             kind,
             operator_id,
             scope_id,
             resolution_note,
             resolution_items,
             created_at,
             updated_at,
             data
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (catalog_entry_id) DO UPDATE SET
             kind = excluded.kind,
             operator_id = excluded.operator_id,
             scope_id = excluded.scope_id,
             resolution_note = excluded.resolution_note,
             resolution_items = excluded.resolution_items,
             created_at = excluded.created_at,
             updated_at = excluded.updated_at,
             data = excluded.data`,
          [
            entry.catalogEntryId,
            entry.kind,
            entry.operatorId,
            entry.scopeId,
            entry.resolutionNote ?? null,
            JSON.stringify(entry.items),
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

export function resolveAuditCatalogChecklistItemResolutionsFilePath(
  workspacePath: string,
): string {
  const resolvedPath = resolve(workspacePath);
  const parsedPath = parse(resolvedPath);

  return join(
    parsedPath.dir,
    `${parsedPath.name}.audit-catalog-checklist-item-resolutions.json`,
  );
}

async function withReadOnlySnapshot<TValue>(
  filePath: string,
  action: (
    snapshot: AuditCatalogChecklistItemResolutionSnapshot,
  ) => TValue | Promise<TValue>,
): Promise<TValue> {
  const snapshot =
    await readAuditCatalogChecklistItemResolutionSnapshot(filePath);

  return action(snapshot);
}

async function withMutableSnapshot<TValue>(
  filePath: string,
  options: Pick<
    FileAuditCatalogChecklistItemResolutionStoreOptions,
    "lockRetryDelayMs" | "lockTimeoutMs"
  >,
  action: (
    snapshot: AuditCatalogChecklistItemResolutionSnapshot,
  ) => Promise<TValue>,
): Promise<TValue> {
  await ensureParentDirectory(filePath);

  return withFileLock(filePath, options, async () =>
    action(await readAuditCatalogChecklistItemResolutionSnapshot(filePath)),
  );
}

async function readAuditCatalogChecklistItemResolutionSnapshot(
  filePath: string,
): Promise<AuditCatalogChecklistItemResolutionSnapshot> {
  try {
    const rawSnapshot = await readFile(filePath, "utf8");
    const parsedSnapshot = JSON.parse(
      rawSnapshot,
    ) as AuditCatalogChecklistItemResolutionSnapshot;

    return {
      resolutionEntries: [...(parsedSnapshot.resolutionEntries ?? [])].map(
        (entry) => clone(entry),
      ),
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        resolutionEntries: [],
      };
    }

    throw error;
  }
}

async function writeAuditCatalogChecklistItemResolutionSnapshot(
  filePath: string,
  snapshot: AuditCatalogChecklistItemResolutionSnapshot,
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
      'Postgres audit catalog checklist item resolutions require DATABASE_URL or an explicit "databaseUrl" option.',
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
    | FileAuditCatalogChecklistItemResolutionStoreOptions
    | SqliteAuditCatalogChecklistItemResolutionStoreOptions,
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
          `Timed out waiting for audit catalog checklist item resolution lock at "${lockPath}".`,
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

function compareCatalogChecklistItemResolutions(
  left: CrossRunAuditCatalogChecklistItemResolution,
  right: CrossRunAuditCatalogChecklistItemResolution,
): number {
  return (
    compareResolutionPriority(left, right) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    left.catalogEntryId.localeCompare(right.catalogEntryId)
  );
}

function compareResolutionPriority(
  left: CrossRunAuditCatalogChecklistItemResolution,
  right: CrossRunAuditCatalogChecklistItemResolution,
): number {
  const leftPriority = left.items.some((item) => item.state === "resolved")
    ? 0
    : 1;
  const rightPriority = right.items.some((item) => item.state === "resolved")
    ? 0
    : 1;

  return leftPriority - rightPriority;
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
