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
  {
    id: "0002_dispatch_queue",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_dispatch_jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        run_id TEXT NOT NULL,
        definition_id TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        enqueued_at TEXT NOT NULL,
        available_at TEXT NOT NULL,
        claimed_at TEXT,
        claimed_by TEXT,
        completed_at TEXT,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_dispatch_jobs_claim
        ON runroot_dispatch_jobs (status, available_at, enqueued_at, id)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_dispatch_jobs_run
        ON runroot_dispatch_jobs (run_id, enqueued_at, id)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_dispatch_jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        run_id TEXT NOT NULL,
        definition_id TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        enqueued_at TEXT NOT NULL,
        available_at TEXT NOT NULL,
        claimed_at TEXT,
        claimed_by TEXT,
        completed_at TEXT,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_dispatch_jobs_claim
        ON runroot_dispatch_jobs (status, available_at, enqueued_at, id)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_dispatch_jobs_run
        ON runroot_dispatch_jobs (run_id, enqueued_at, id)`,
    ],
  },
  {
    id: "0003_tool_history",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_tool_history (
        call_id TEXT PRIMARY KEY,
        run_id TEXT,
        step_id TEXT,
        dispatch_job_id TEXT,
        worker_id TEXT,
        execution_mode TEXT,
        tool_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_source TEXT NOT NULL,
        invocation_source TEXT NOT NULL,
        attempt INTEGER,
        outcome TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_tool_history_run_started
        ON runroot_tool_history (run_id, started_at, call_id)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_tool_history (
        call_id TEXT PRIMARY KEY,
        run_id TEXT,
        step_id TEXT,
        dispatch_job_id TEXT,
        worker_id TEXT,
        execution_mode TEXT,
        tool_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_source TEXT NOT NULL,
        invocation_source TEXT NOT NULL,
        attempt INTEGER,
        outcome TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_tool_history_run_started
        ON runroot_tool_history (run_id, started_at, call_id)`,
    ],
  },
  {
    id: "0004_saved_audit_views",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_saved_audit_views (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_saved_audit_views_updated
        ON runroot_saved_audit_views (updated_at DESC, created_at DESC, id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_saved_audit_views (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_saved_audit_views_updated
        ON runroot_saved_audit_views (updated_at DESC, created_at DESC, id ASC)`,
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

export function getRuntimePersistenceMigrations(
  dialect: PersistenceDialect,
): readonly {
  readonly id: string;
  readonly statements: readonly string[];
}[] {
  return runtimePersistenceMigrations.map((migration) => ({
    id: migration.id,
    statements: migration[dialect],
  }));
}
