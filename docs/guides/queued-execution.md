# Queued Execution

Phase 9 adds the minimum queue-backed execution path for Runroot.

This phase does not add new workflow behavior. It changes how runs are driven:
API, CLI, and SDK surfaces can now enqueue work, and a separate worker process
can claim that work and execute the existing runtime.

## Goal

The queued-execution path closes the main topology gap left after the
persistence baseline:

- request-handling processes no longer need to stay alive for a run to finish
- queued work is modeled through a shared dispatch contract
- worker coordination stays thin and reuses the existing runtime, approvals, and replay model

Replay and approvals still derive from persisted runtime and approval events.
Queue jobs are execution plumbing, not a second audit source of truth.

## Execution Modes

Relevant environment variables:

- `RUNROOT_EXECUTION_MODE`
- `RUNROOT_PERSISTENCE_DRIVER`
- `RUNROOT_SQLITE_PATH`
- `DATABASE_URL`
- `RUNROOT_WORKER_ID`
- `RUNROOT_WORKER_POLL_INTERVAL_MS`

Supported execution mode values:

- `inline`
- `queued`

Default:

- `inline`

Queued execution requires database-backed persistence:

- `postgres`
- `sqlite`

The legacy `file` adapter remains available for inline compatibility paths, but
it is not a queued-execution backend.

## Local SQLite Path

Minimum local queued path with SQLite:

```bash
pnpm db:migrate:sqlite
RUNROOT_EXECUTION_MODE=queued pnpm dev:queued
```

This starts:

- the API
- the web console
- the worker

with SQLite at `RUNROOT_SQLITE_PATH`.

## Local Postgres Path

Minimum local queued path with Postgres:

```bash
pnpm infra:up
pnpm db:migrate:postgres
RUNROOT_PERSISTENCE_DRIVER=postgres RUNROOT_EXECUTION_MODE=queued pnpm dev:queued
```

With `DATABASE_URL` configured, the queued-execution path uses Postgres as the
primary durable queue and runtime store.

## Worker Responsibilities

The worker is intentionally narrow:

- claim queued work
- restore the existing run from persistence
- execute or resume the run through the current runtime engine
- mark the dispatch job completed or failed

The worker does not introduce:

- product-owned orchestration logic
- advanced scheduling
- sharding
- autoscaling
- HA deployment concerns

## Approval-Aware Resume

Queued execution preserves the existing approval semantics:

1. a run pauses and persists approval facts
2. an approval decision is recorded through the existing operator seam
3. resume enqueues follow-up work
4. the worker claims that work and drives the run forward

The source of truth remains:

- persisted runtime events
- persisted approval events

not worker-local state.

## Deferred Work

Phase 9 deliberately leaves these items for later phases:

- worker sharding and autoscaling
- hosted queue operations
- broad deployment topology work
- full observability backend integration
- promotion of all tool hooks into persisted replay history
