# Approval Flow

Approvals are treated as first-class workflow state, not an afterthought.

## Phase 4 Flow

1. a running workflow step requests approval through the runtime seam
2. runtime persists a pending approval request together with paused run state and `approval.requested`
3. operator records an approval decision
4. approved requests allow an explicit resume path
5. rejected or cancelled requests drive the run into a terminal cancelled state

## Boundary Split

- `@runroot/approvals`
  - owns approval request and decision domain models
  - owns approval state transition rules and operator-facing errors
- `@runroot/core-runtime`
  - owns when a step may request approval
  - owns how a run pauses, resumes, or becomes cancelled because of approval state
- shared runtime event stream
  - persists approval request and decision facts for replay

## Minimal Runtime Contract

Phase 4 keeps the runtime contract intentionally small:

- steps can request approval while running
- paused runs with pending approvals cannot resume
- approved requests unblock resume
- rejected or cancelled requests produce a terminal cancelled run

Phase 4 does not implement notification fan-out, Slack approval UX, or policy routing.
