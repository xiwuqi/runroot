export type PersistenceDialect = "postgres" | "sqlite";

export interface PersistenceMigration {
  readonly id: string;
  readonly postgres: readonly string[];
  readonly sqlite: readonly string[];
}

export const runtimePersistenceMigrations = [
  {
    id: "0001_persistence_baseline",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS runroot_runs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL,
        definition_id TEXT NOT NULL,
        definition_name TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_runs_created_at
        ON runroot_runs (created_at, id)`,
      `CREATE TABLE IF NOT EXISTS runroot_approvals (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_approvals_run_requested
        ON runroot_approvals (run_id, requested_at, id)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_approvals_pending
        ON runroot_approvals (run_id, status, requested_at, id)`,
      `CREATE TABLE IF NOT EXISTS runroot_checkpoints (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_runroot_checkpoints_run_sequence
        ON runroot_checkpoints (run_id, sequence)`,
      `CREATE TABLE IF NOT EXISTS runroot_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        occurred_at TEXT NOT NULL,
        name TEXT NOT NULL,
        step_id TEXT,
        data TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_runroot_events_run_sequence
        ON runroot_events (run_id, sequence)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_events_run_occurred
        ON runroot_events (run_id, occurred_at, id)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS runroot_runs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL,
        definition_id TEXT NOT NULL,
        definition_name TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_runs_created_at
        ON runroot_runs (created_at, id)`,
      `CREATE TABLE IF NOT EXISTS runroot_approvals (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        status TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_approvals_run_requested
        ON runroot_approvals (run_id, requested_at, id)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_approvals_pending
        ON runroot_approvals (run_id, status, requested_at, id)`,
      `CREATE TABLE IF NOT EXISTS runroot_checkpoints (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_runroot_checkpoints_run_sequence
        ON runroot_checkpoints (run_id, sequence)`,
      `CREATE TABLE IF NOT EXISTS runroot_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        occurred_at TEXT NOT NULL,
        name TEXT NOT NULL,
        step_id TEXT,
        data TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_runroot_events_run_sequence
        ON runroot_events (run_id, sequence)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_events_run_occurred
        ON runroot_events (run_id, occurred_at, id)`,
    ],
  },
] as const satisfies readonly PersistenceMigration[];

export function getRuntimePersistenceMigrationStatements(
  dialect: PersistenceDialect,
): readonly string[] {
  return runtimePersistenceMigrations.flatMap(
    (migration) => migration[dialect],
  );
}
