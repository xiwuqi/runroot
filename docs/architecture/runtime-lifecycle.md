# Runtime Lifecycle

This document describes the Phase 2 runtime lifecycle now implemented in the core packages.

## Run Lifecycle

The Phase 2 runtime follows this sequence:

1. create a run snapshot with explicit step snapshots
2. atomically persist the run snapshot, lifecycle events, and optional checkpoint
3. mark the first runnable step as `ready`
4. transition the run through `queued` and `running`
5. execute the current step
6. atomically persist step events plus a checkpoint
7. either:
   - advance to the next step
   - schedule a retry
   - pause the run
   - fail the run
   - complete the run

## Pause And Resume

Phase 2 supports pause and resume through checkpoints.

- a step can return a pause signal with checkpoint payload
- the runtime persists the checkpoint and marks the run as `paused`
- `resumeRun` reloads the latest checkpoint and restarts execution from that cursor
- the public `pauseRun` API is only valid once a run has entered `queued` or `running`
- attempting to pause a `pending` run fails with a runtime-level error instead of leaking a domain transition error

Phase 2 pause/resume is synchronous and process-local around a shared persistence adapter. Distributed coordination is intentionally deferred.

## Retry Model

Phase 2 supports:

- max attempts
- constant and exponential backoff calculation
- retry scheduling as an explicit step state and event

The Phase 2 engine records retry delay metadata but does not sleep or rely on an external queue. It immediately re-enters the execution loop.
