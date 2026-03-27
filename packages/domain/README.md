# @runroot/domain

Owns the shared language for runs, steps, tool calls, approvals, and replay entities.

Phase 2 exports:

- run, step, and checkpoint snapshots
- retry policy resolution and backoff calculation
- pure run and step state transition helpers
- serialized failure details

Example:

```ts
import {
  createWorkflowRunSnapshot,
  createWorkflowStepSnapshot,
  resolveRetryPolicy,
} from "@runroot/domain";

const retryPolicy = resolveRetryPolicy({
  delayMs: 250,
  maxAttempts: 3,
});

const step = createWorkflowStepSnapshot({
  createdAt: new Date().toISOString(),
  id: "step_prepare",
  index: 0,
  key: "prepare",
  name: "Prepare",
  retryPolicy,
  runId: "run_123",
});

const run = createWorkflowRunSnapshot({
  createdAt: new Date().toISOString(),
  definitionId: "workflow.prepare",
  definitionName: "Prepare workflow",
  definitionVersion: "0.1.0",
  id: "run_123",
  input: { source: "cli" },
  retryPolicy,
  steps: [step],
});
```
