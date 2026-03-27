# @runroot/core-runtime

Owns workflow orchestration, state transitions, retry policy, checkpoint semantics, and pause/resume behavior.

Phase 2 exports:

- workflow definition and step execution contracts
- a synchronous runtime engine with retry, pause/resume, and atomic transition persistence
- run and event query helpers backed by the persistence abstraction

`pauseRun` is intentionally narrow in Phase 2: it is only valid after a run has entered `queued` or `running`. Pending runs must be started with `executeRun` first.

Example:

```ts
import { RuntimeEngine, completeStep } from "@runroot/core-runtime";
import { createInMemoryRuntimePersistence } from "@runroot/persistence";

const runtime = new RuntimeEngine({
  persistence: createInMemoryRuntimePersistence(),
});

const definition = {
  id: "workflow.example",
  name: "Example workflow",
  steps: [
    {
      execute: async () => completeStep({ status: "ok" }),
      key: "prepare",
      name: "Prepare",
    },
  ],
  version: "0.1.0",
};

const run = await runtime.createRun(definition, { trigger: "docs" });
await runtime.executeRun(definition, run.id);
```
