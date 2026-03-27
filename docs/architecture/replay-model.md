# Replay Model

Replay is based on immutable events rather than mutable snapshots alone.

## Phase 4 Baseline

Phase 2 established the core event and checkpoint model. Phase 4 adds the first derived replay/timeline projection on top of that baseline.

- immutable run and step lifecycle events
- per-run event ordering
- checkpoints that capture resumable cursor state
- persisted approval request and decision events

## Contract Split

- event log: execution history and audit record
- checkpoints: resumable state hint for the runtime
- run snapshot: current materialized status for fast access
- approval snapshot: current approval state for runtime gating and operator queries

## Timeline Projection

Phase 4 replay answers a focused set of questions:

- when a run started
- when it entered waiting-for-approval
- when an approval was approved, rejected, or cancelled
- when the run resumed, failed, was cancelled, or completed

The timeline is projected from persisted runtime events. Approval snapshots help runtime semantics, but the timeline itself is derived from immutable events.

## Tool Hook Boundary

Tool invocation lifecycle hooks from Phase 3 remain in-memory hooks in `@runroot/tools`.

Phase 4 does not automatically project them into replay. Only persisted runtime events are part of the replay source of truth.
