# @runroot/approvals

Owns approval requests, decision records, and resume policy boundaries.

Phase 4 exports:

- approval request and decision domain models
- approval state transitions and domain errors
- pure helpers for creating requests and recording decisions

Example:

```ts
import { createApprovalRequest, decideApproval } from "@runroot/approvals";

const request = createApprovalRequest({
  id: "approval_1",
  requestedAt: "2026-03-27T00:00:00.000Z",
  reviewer: {
    id: "ops_1",
  },
  runId: "run_1",
  stepId: "step_1",
});

const result = decideApproval(request, {
  actor: {
    id: "ops_1",
  },
  approvalId: "approval_1",
  decidedAt: "2026-03-27T00:01:00.000Z",
  decision: "approved",
});
```

`@runroot/approvals` does not resume runs by itself. Runtime pause/resume semantics stay in `@runroot/core-runtime`.
