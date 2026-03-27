# ADR-0006: Approval Events And Replay Timeline

## Status

Accepted

## Context

Phase 4 adds approval gates and replay foundations on top of the Phase 2 runtime core and the Phase 3 tool layer.

Runroot now needs to answer:

- when a run entered a waiting-for-approval state
- when an approval was approved, rejected, or cancelled
- when a paused run resumed or became terminal
- which events must become persisted audit history and which hooks should stay in-memory only

Phase 3 already introduced tool invocation lifecycle hooks, but those hooks were intentionally left outside the shared runtime event stream.

## Decision

Keep approval state as a first-class domain in `@runroot/approvals`, but persist approval request and decision facts through the shared runtime event stream.

Phase 4 adopts the following rules:

- approval requests and approval decisions are persisted domain state
- `approval.requested`, `approval.approved`, `approval.rejected`, and `approval.cancelled` enter the shared runtime event stream
- replay timeline projections use persisted runtime events as the source of truth
- approval snapshots remain queryable state for runtime gating and operator queries, but replay is derived from the immutable event stream
- tool invocation lifecycle hooks remain package-level hooks in `@runroot/tools`; they do not automatically enter the shared runtime event stream in Phase 4
- a run waiting for approval still uses the existing paused run state; entering waiting-for-approval is identified by the `approval.requested` event and the pending approval snapshot

## Consequences

Positive:

- replay and audit remain rooted in one persisted event history
- approval queries stay explicit without forcing replay to depend on mutable approval snapshots
- the project avoids prematurely persisting every tool hook before its replay value is proven
- runtime approval semantics can stay minimal: request, decide, resume, or cancel

Negative:

- approval events become part of the runtime event compatibility surface
- replay timelines need an explicit projection layer instead of reading raw events directly
- runs paused for non-approval reasons still share the same paused run status and must be distinguished by approval state

## Revisit Trigger

Revisit if:

- tool invocation history needs to become part of persisted replay rather than hook-only observability
- approval workflows grow beyond a single request and single terminal decision
- replay timelines need more than one derived projection style
