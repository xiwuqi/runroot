# Persistence Baseline

Phase 8 introduces the minimum database-backed persistence baseline for
Runroot. This phase does not add new workflow features. It replaces the default
local JSON workspace path with configured database-backed persistence while
keeping runtime, approval, replay, API, CLI, and web semantics unchanged.

## Goal

The persistence baseline closes the gap between the accepted architecture and
the repository's temporary local-only storage path:

- Postgres is the primary durable backing store
- SQLite is the local-development fallback
- the JSON-file adapter remains available only as a legacy compatibility path

## Driver Selection

The default operator selection order is:

1. explicit driver configuration in code
2. `RUNROOT_PERSISTENCE_DRIVER`
3. legacy `RUNROOT_WORKSPACE_PATH`, which forces the JSON-file adapter
4. `DATABASE_URL`, which selects Postgres
5. SQLite fallback at `RUNROOT_SQLITE_PATH`

Supported driver values:

- `postgres`
- `sqlite`
- `file`
- `memory`

`file` and `memory` are compatibility and test paths. They are not the intended
default for normal operator usage after Phase 8.

## Environment

Relevant environment variables:

- `RUNROOT_PERSISTENCE_DRIVER`
- `RUNROOT_SQLITE_PATH`
- `DATABASE_URL`
- `RUNROOT_POSTGRES_DB`
- `RUNROOT_POSTGRES_USER`
- `RUNROOT_POSTGRES_PASSWORD`
- `RUNROOT_POSTGRES_PORT`
- `RUNROOT_WORKSPACE_PATH` (legacy JSON-file override)

See [`.env.example`](../../.env.example) for the current defaults.

## Local Postgres Path

Minimum local path:

```bash
pnpm infra:up
pnpm db:migrate:postgres
```

Then run the operator surfaces normally:

```bash
pnpm dev
```

With `DATABASE_URL` set, the default configured persistence path is Postgres.

## Local SQLite Fallback

Minimum local SQLite path:

```bash
pnpm db:migrate:sqlite
pnpm dev
```

If no explicit driver is set and `DATABASE_URL` is absent, Runroot falls back
to SQLite at `RUNROOT_SQLITE_PATH`.

## Scoped Parity Gaps

SQLite is the local-development fallback, not the primary deployment target.
Phase 8 should document any intentionally retained gaps rather than hiding them.

Examples of acceptable Phase 8 parity gaps:

- SQL features that stay Postgres-first when the fallback can still satisfy the
  repository contracts
- looser concurrency expectations in SQLite local development
- migration behavior that is intentionally simpler for local fallback use

Examples of unacceptable Phase 8 behavior:

- weakening the shared contracts to match SQLite first
- treating SQLite as the production-default database strategy
- changing replay or approval source-of-truth semantics

## Migrations

Phase 8 adds the minimum schema and migration path needed for:

- runs
- runtime events
- checkpoints
- approvals
- migration bookkeeping

Migrations should stay explicit and reviewable. This phase is not a deployment
platform and it is not a database-operations phase.

## Relationship To Replay

Replay still reads persisted runtime and approval events. The database baseline
changes where those durable facts live, not what counts as a durable fact.

Tool lifecycle hooks remain separate in-memory seams. Phase 8 does not promote
all tool hooks into persisted replay history.
