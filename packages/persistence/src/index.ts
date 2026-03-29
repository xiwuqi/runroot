import type { PackageBoundary } from "@runroot/config";

export {
  type ConfiguredRuntimePersistenceOptions,
  createConfiguredRuntimePersistence,
  createPostgresRuntimePersistence,
  createSqliteRuntimePersistence,
  type MigrationResult,
  migratePostgresPersistence,
  migrateSqlitePersistence,
  type PostgresRuntimePersistenceOptions,
  type SqliteRuntimePersistenceOptions,
} from "./database-store";
export {
  type ConfiguredDispatchQueueOptions,
  createConfiguredDispatchQueue as createConfiguredRunDispatchQueue,
  createConfiguredDispatchQueue,
  createPostgresDispatchQueue,
  createSqliteDispatchQueue,
  type PostgresDispatchQueueOptions,
  type SqliteDispatchQueueOptions,
} from "./dispatch-store";
export type { PersistenceDialect } from "./migrations";
export {
  type ApprovalRepository,
  type CheckpointRepository,
  type CheckpointWrite,
  createFileRuntimePersistence,
  createInMemoryRuntimePersistence,
  createRuntimePersistenceSnapshot,
  type EventRepository,
  type FileRuntimePersistenceOptions,
  type InMemoryRuntimePersistenceOptions,
  type RunRepository,
  type RuntimePersistence,
  type RuntimePersistenceSnapshot,
  type RuntimeTransitionCommit,
  type RuntimeTransitionCommitResult,
} from "./runtime-store";
export {
  type ConfiguredSavedAuditViewStoreOptions,
  createConfiguredSavedAuditViewStore,
  createFileSavedAuditViewStore,
  createInMemorySavedAuditViewStore,
  createPostgresSavedAuditViewStore,
  createSqliteSavedAuditViewStore,
  type FileSavedAuditViewStoreOptions,
  type InMemorySavedAuditViewStoreOptions,
  type PostgresSavedAuditViewStoreOptions,
  resolveSavedAuditViewsFilePath,
  type SqliteSavedAuditViewStoreOptions,
} from "./saved-view-store";
export {
  type ConfiguredToolHistoryStoreOptions,
  createConfiguredToolHistoryStore,
  createFileToolHistoryStore,
  createInMemoryToolHistoryStore,
  createPostgresToolHistoryStore,
  createSqliteToolHistoryStore,
  type FileToolHistoryStoreOptions,
  type InMemoryToolHistoryStoreOptions,
  type PostgresToolHistoryStoreOptions,
  resolveToolHistoryFilePath,
  type SqliteToolHistoryStoreOptions,
} from "./tool-history-store";

export const persistencePackageBoundary = {
  name: "@runroot/persistence",
  kind: "package",
  phaseOwned: 2,
  responsibility:
    "Repository contracts, checkpoint storage, database adapters, dispatch queue persistence seams, tool-history storage adapters, and additive saved-audit-view adapters.",
  publicSurface: [
    "repository interfaces",
    "storage adapters",
    "checkpoint persistence",
    "dispatch queue adapters",
    "tool history adapters",
    "saved audit view adapters",
  ],
} as const satisfies PackageBoundary;
