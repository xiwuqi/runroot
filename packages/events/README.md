# @runroot/events

Owns immutable event contracts and derived event stream concerns.

Phase 4 exports the typed runtime event model used by the runtime, persistence, approvals, and replay layers.

The shared event stream now includes:

- run and step lifecycle events
- checkpoint persistence events
- approval request and approval decision events

Tool invocation hooks remain out of this package in Phase 4. They stay as in-memory hooks in `@runroot/tools` until the replay model needs them as persisted history.

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
