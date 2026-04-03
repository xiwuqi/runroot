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
  {
    id: "0005_audit_view_catalog_entries",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_view_catalog_entries (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_view_catalog_entries_updated
        ON runroot_audit_view_catalog_entries (archived_at, updated_at DESC, created_at DESC, id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_view_catalog_entries (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_view_catalog_entries_updated
        ON runroot_audit_view_catalog_entries (archived_at, updated_at DESC, created_at DESC, id ASC)`,
    ],
  },
  {
    id: "0006_audit_catalog_visibility",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_visibility (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        visibility_state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_visibility_scope
        ON runroot_audit_catalog_visibility (scope_id, visibility_state, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_visibility_owner
        ON runroot_audit_catalog_visibility (owner_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_visibility (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        visibility_state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_visibility_scope
        ON runroot_audit_catalog_visibility (scope_id, visibility_state, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_visibility_owner
        ON runroot_audit_catalog_visibility (owner_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
  },
  {
    id: "0007_audit_catalog_review_signals",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_review_signals (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        review_state TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_signals_scope
        ON runroot_audit_catalog_review_signals (scope_id, review_state, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_signals_operator
        ON runroot_audit_catalog_review_signals (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_review_signals (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        review_state TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_signals_scope
        ON runroot_audit_catalog_review_signals (scope_id, review_state, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_signals_operator
        ON runroot_audit_catalog_review_signals (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
  },
  {
    id: "0008_audit_catalog_review_assignments",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_review_assignments (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        assigner_id TEXT NOT NULL,
        assignee_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        assignment_state TEXT NOT NULL,
        handoff_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_assignments_scope
        ON runroot_audit_catalog_review_assignments (scope_id, assignment_state, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_assignments_assignee
        ON runroot_audit_catalog_review_assignments (assignee_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_assignments_assigner
        ON runroot_audit_catalog_review_assignments (assigner_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_review_assignments (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        assigner_id TEXT NOT NULL,
        assignee_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        assignment_state TEXT NOT NULL,
        handoff_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_assignments_scope
        ON runroot_audit_catalog_review_assignments (scope_id, assignment_state, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_assignments_assignee
        ON runroot_audit_catalog_review_assignments (assignee_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_review_assignments_assigner
        ON runroot_audit_catalog_review_assignments (assigner_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
  },
  {
    id: "0009_audit_catalog_assignment_checklists",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_assignment_checklists (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        checklist_state TEXT NOT NULL,
        checklist_items TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_assignment_checklists_scope
        ON runroot_audit_catalog_assignment_checklists (scope_id, checklist_state, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_assignment_checklists_operator
        ON runroot_audit_catalog_assignment_checklists (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_assignment_checklists (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        checklist_state TEXT NOT NULL,
        checklist_items TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_assignment_checklists_scope
        ON runroot_audit_catalog_assignment_checklists (scope_id, checklist_state, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_assignment_checklists_operator
        ON runroot_audit_catalog_assignment_checklists (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
  },
  {
    id: "0010_audit_catalog_checklist_item_progress",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_progress (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        completion_note TEXT,
        progress_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_progress_scope
        ON runroot_audit_catalog_checklist_item_progress (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_progress_operator
        ON runroot_audit_catalog_checklist_item_progress (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_progress (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        completion_note TEXT,
        progress_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_progress_scope
        ON runroot_audit_catalog_checklist_item_progress (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_progress_operator
        ON runroot_audit_catalog_checklist_item_progress (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
  },
  {
    id: "0011_audit_catalog_checklist_item_blockers",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_blockers (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        blocker_note TEXT,
        blocker_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_blockers_scope
        ON runroot_audit_catalog_checklist_item_blockers (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_blockers_operator
        ON runroot_audit_catalog_checklist_item_blockers (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_blockers (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        blocker_note TEXT,
        blocker_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_blockers_scope
        ON runroot_audit_catalog_checklist_item_blockers (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_blockers_operator
        ON runroot_audit_catalog_checklist_item_blockers (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
  },
  {
    id: "0012_audit_catalog_checklist_item_resolutions",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_resolutions (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        resolution_note TEXT,
        resolution_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_resolutions_scope
        ON runroot_audit_catalog_checklist_item_resolutions (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_resolutions_operator
        ON runroot_audit_catalog_checklist_item_resolutions (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_resolutions (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        resolution_note TEXT,
        resolution_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_resolutions_scope
        ON runroot_audit_catalog_checklist_item_resolutions (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_resolutions_operator
        ON runroot_audit_catalog_checklist_item_resolutions (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
  },
  {
    id: "0013_audit_catalog_checklist_item_verifications",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_verifications (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        verification_note TEXT,
        verification_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_verifications_scope
        ON runroot_audit_catalog_checklist_item_verifications (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_verifications_operator
        ON runroot_audit_catalog_checklist_item_verifications (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_verifications (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        verification_note TEXT,
        verification_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_verifications_scope
        ON runroot_audit_catalog_checklist_item_verifications (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_verifications_operator
        ON runroot_audit_catalog_checklist_item_verifications (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
  },
  {
    id: "0014_audit_catalog_checklist_item_evidence",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_evidence (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        evidence_note TEXT,
        evidence_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_evidence_scope
        ON runroot_audit_catalog_checklist_item_evidence (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_evidence_operator
        ON runroot_audit_catalog_checklist_item_evidence (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_evidence (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        evidence_note TEXT,
        evidence_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_evidence_scope
        ON runroot_audit_catalog_checklist_item_evidence (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_evidence_operator
        ON runroot_audit_catalog_checklist_item_evidence (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
  },
  {
    id: "0015_audit_catalog_checklist_item_attestation",
    postgres: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_attestation (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        attestation_note TEXT,
        attestation_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_attestation_scope
        ON runroot_audit_catalog_checklist_item_attestation (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_attestation_operator
        ON runroot_audit_catalog_checklist_item_attestation (operator_id, updated_at DESC, catalog_entry_id ASC)`,
    ],
    sqlite: [
      `CREATE TABLE IF NOT EXISTS runroot_audit_catalog_checklist_item_attestation (
        catalog_entry_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        attestation_note TEXT,
        attestation_items TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_attestation_scope
        ON runroot_audit_catalog_checklist_item_attestation (scope_id, updated_at DESC, catalog_entry_id ASC)`,
      `CREATE INDEX IF NOT EXISTS idx_runroot_audit_catalog_checklist_item_attestation_operator
        ON runroot_audit_catalog_checklist_item_attestation (operator_id, updated_at DESC, catalog_entry_id ASC)`,
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
