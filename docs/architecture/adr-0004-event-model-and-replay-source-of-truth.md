# ADR-0004: Event Model And Replay Source Of Truth

## Status

Accepted

## Context

Runroot needs durable execution primitives in Phase 2 without prematurely building the replay subsystem from Phase 4. The runtime still needs an audit-friendly record of what happened so retries, pause/resume, and later replay can all reason from the same history.

## Decision

Adopt an immutable runtime event log as the source of truth for execution history. Persist checkpoints separately as resumable state hints, not as the only record of behavior.

Phase 2 implements:

- typed runtime events for run and step lifecycle changes
- monotonically ordered per-run event sequences
- checkpoints that capture the next resumable cursor and optional step payload
- an atomic transition commit boundary for `run + events + optional checkpoint`
- an in-memory persistence adapter that exercises the contracts before database adapters land

Phase 2 does not implement full replay queries or timeline UIs. Those remain in Phase 4 and later.

## Consequences

Positive:

- retries, failures, and pause/resume all emit explicit history
- replay work in later phases can build on an established event contract
- checkpoints stay focused on resumability instead of becoming a hidden mutable source of truth
- future persistence adapters have a clear transactional contract to preserve

Negative:

- event naming becomes a compatibility surface earlier in the project
- later persistence adapters must preserve ordering semantics and atomic transition semantics

## Revisit Trigger

Revisit if event verbosity becomes too high or if replay requirements need a different event partitioning strategy.
