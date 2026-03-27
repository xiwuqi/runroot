# @runroot/events

Owns immutable event contracts and derived event stream concerns.

Phase 2 exports the typed runtime event model used by the core runtime and persistence layer.

Example:

```ts
import type { RuntimeEventInput } from "@runroot/events";

const event: RuntimeEventInput<"run.created"> = {
  name: "run.created",
  occurredAt: new Date().toISOString(),
  payload: {
    definitionId: "workflow.prepare",
    status: "pending",
  },
  runId: "run_123",
};
```
