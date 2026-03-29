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
- correlation attributes for run, step, dispatch job, worker, and tool
  identifiers across inline and queued execution

## What Does Not Exist Yet

- OpenTelemetry exporter wiring
- metrics backend
- observability UI platform
- productized dashboard or analytics suite
- provider-specific payload persistence by default
- cross-run audit exploration or broad analytics products

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
