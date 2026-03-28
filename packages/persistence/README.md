# @runroot/persistence

Owns repository contracts, event storage abstractions, and database adapter seams.

Current exports:

- run, event, checkpoint, and approval repository contracts
- an atomic transition commit boundary for `run + events + optional checkpoint + optional approval state`
- an in-memory reference adapter for local execution and integration tests
- a JSON-file adapter for legacy local operator workflows
- database-backed adapter seams for the Phase 8 persistence baseline
- dispatch queue adapters for the Phase 9 queued-execution path

Example:

```ts
import {
  createConfiguredRuntimePersistence,
  createInMemoryRuntimePersistence,
} from "@runroot/persistence";

const persistence = createInMemoryRuntimePersistence();
const configuredPersistence = createConfiguredRuntimePersistence();
```

## Driver Selection

The Phase 8 default selection order is:

1. explicit driver configuration
2. `RUNROOT_PERSISTENCE_DRIVER`
3. legacy `RUNROOT_WORKSPACE_PATH` forcing the JSON-file adapter
4. `DATABASE_URL` forcing Postgres
5. SQLite fallback at `RUNROOT_SQLITE_PATH`

The JSON-file adapter remains available as a compatibility path, but it is no
longer the default operator persistence path.

For Phase 9 queued execution, the supported backends are:

- Postgres
- SQLite

The legacy JSON-file adapter remains inline-only and cannot back the dispatch
queue path.

## Phase 8 Boundaries

- Postgres is the primary durable backing store.
- SQLite exists for local development fallback only.
- Replay and approval facts still derive from persisted runtime and approval
  events.
- The persistence package owns schema, migrations, and adapter seams. Apps and
  operator surfaces must keep using the shared contracts.
- Queue-backed execution uses the shared dispatch queue seam rather than
  app-owned queue logic.
