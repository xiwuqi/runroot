# Observability Foundations

Phase 6 introduces minimal observability seams without changing replay semantics.

## What Exists

- `@runroot/observability` logger contract
- `@runroot/observability` tracer contract
- noop adapters for safe defaults
- local memory adapters for tests
- persisted tool-history records behind the shared tool hook seam
- run-scoped correlated audit views built from replay, dispatch, worker, and
  tool-history facts
- cross-run audit query and filter paths over the same derived audit facts
- cross-run audit drilldowns constrained by stable identifiers over the same
  derived audit facts
- linked audit navigation that connects summaries, drilldowns, and existing
  run-scoped audit views through the same seams
- saved audit views that persist constrained navigation state without
  snapshotting replay or approval data
- audit view catalogs that publish constrained saved views into reusable
  operator presets without becoming a collaborative catalog product
- catalog visibility metadata that distinguishes personal and shared presets
  without becoming an RBAC, multi-tenant, or collaboration platform
- catalog review signals and shared notes that annotate visible presets without
  becoming replay, approval, threaded collaboration, or a review workflow
  product
- catalog review assignments and operator handoffs that annotate reviewed
  visible presets without becoming replay, approval, workflow orchestration,
  or a collaboration platform
- correlation attributes for run, step, dispatch job, worker, and tool
  identifiers across inline and queued execution

## What Does Not Exist Yet

- OpenTelemetry exporter wiring
- metrics backend
- observability UI platform
- productized dashboard or analytics suite
- provider-specific payload persistence by default
- broad cross-run audit exploration or open-ended analytics products
- collaborative catalog, RBAC, or multi-user curation products
- multi-tenant access-control or SaaS catalog products

## Current Boundary

- replay timeline still comes from persisted runtime and approval events
- tool lifecycle hooks can now persist scoped tool-history rows without becoming
  replay input
- observability adapters are for request tracing and structured logging, not
  for replacing replay
- inline and queued execution share the same correlation identifiers through the
  existing seams
- correlated audit views stay derived and operator-facing instead of becoming a
  second workflow-state model
- cross-run audit queries stay structured and thin instead of becoming a
  dashboard or analytics product
- identifier-driven drilldowns stay constrained and operator-facing instead of
  turning into a dashboard, search, or analytics platform
- linked audit navigation stays thin and operator-facing instead of turning
  into a dashboard, search, or analytics platform
- saved audit views stay thin and operator-facing instead of turning into a
  catalog, dashboard, search, or analytics platform
- audit view catalogs stay thin and operator-facing instead of turning into a
  collaborative catalog, dashboard, search, or analytics platform
- catalog visibility stays thin and operator-facing instead of turning into an
  RBAC system, discovery portal, or collaboration platform
- catalog review signals stay thin and operator-facing instead of turning into
  threaded collaboration, assignments, review workflows, dashboards, search,
  or analytics platforms
- catalog review assignments stay thin and operator-facing instead of turning
  into threaded collaboration, workflow engines, RBAC, dashboards, search, or
  analytics platforms

## Minimal Local Path

Tool history follows the same execution and persistence choices already used by
the runtime:

- inline execution persists tool history beside the active persistence path
- queued execution persists tool history beside the active dispatch and runtime
  persistence path
- Postgres and SQLite store tool history in the same database used for runtime
  and dispatch state
- the legacy file path keeps tool history in a compatibility sidecar instead of
  expanding the workspace snapshot into a new replay source

No additional observability backend configuration is required in this phase.
