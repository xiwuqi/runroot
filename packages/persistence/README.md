# @runroot/persistence

Owns repository contracts, event storage abstractions, and database adapter seams.

Phase 2 exports:

- run, event, checkpoint, and approval repository contracts
- an atomic transition commit boundary for `run + events + optional checkpoint + optional approval state`
- an in-memory reference adapter for local execution and integration tests
- a JSON-file adapter for local operator workflows in Phase 5

Example:

```ts
import { createInMemoryRuntimePersistence } from "@runroot/persistence";

const persistence = createInMemoryRuntimePersistence();
```

Postgres and SQLite adapters remain deferred. The in-memory adapter validates the contracts first, and the JSON-file adapter exists only to make local API/CLI workflows usable before a real database adapter lands.
