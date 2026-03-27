# @runroot/persistence

Owns repository contracts, event storage abstractions, and database adapter seams.

Phase 2 exports:

- run, event, and checkpoint repository contracts
- an atomic transition commit boundary for `run + events + optional checkpoint`
- an in-memory reference adapter for local execution and integration tests

Example:

```ts
import { createInMemoryRuntimePersistence } from "@runroot/persistence";

const persistence = createInMemoryRuntimePersistence();
```

Postgres and SQLite adapters remain deferred. The in-memory adapter exists to validate the contracts and runtime behavior first.
