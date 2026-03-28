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

export const persistencePackageBoundary = {
  name: "@runroot/persistence",
  kind: "package",
  phaseOwned: 2,
  responsibility:
    "Repository contracts, checkpoint storage, database adapters, and dispatch queue persistence seams.",
  publicSurface: [
    "repository interfaces",
    "storage adapters",
    "checkpoint persistence",
    "dispatch queue adapters",
  ],
} as const satisfies PackageBoundary;
