# Replay Model

Replay is based on immutable events rather than mutable snapshots alone.

## Phase 2 Baseline

Phase 2 establishes the core data that replay will depend on later:

- immutable run and step lifecycle events
- per-run event ordering
- checkpoints that capture resumable cursor state

## Contract Split

- event log: execution history and audit record
- checkpoints: resumable state hint for the runtime
- run snapshot: current materialized status for fast access

Phase 2 stops at producing this data model. Replay queries, timeline projections, and operator views remain deferred to Phase 4.
