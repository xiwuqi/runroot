# ADR-0011: Correlated Audit Projections And Operator Views

## Status

Accepted

## Context

Phase 10 made tool history durable and correlated it across inline and queued
execution, but operators still had to read replay timeline facts, dispatch
facts, and tool-history facts through separate minimal paths. The repository
already documents that replay may need more than one derived projection style,
and that tool-level observability in the UI should stay thin until durable
tool facts exist.

Runroot now needs a minimal correlated audit projection that stays additive:

- replay and approval still derive only from persisted runtime and approval
  events
- dispatch, worker, and tool-history facts remain operator-facing audit data
- provider-specific payloads do not become part of a shared audit contract
- API, CLI, SDK, and web stay thin seams over shared package-owned read models

## Decision

Phase 11 adds a shared correlated audit projection and thin operator-facing read
paths.

1. `@runroot/replay` owns the shared correlated audit projection contract.
   - The projection joins persisted runtime and approval events with additive
     dispatch and tool-history facts for one run.
   - The contract is read-only and scoped to operator-facing audit views.
2. `@runroot/sdk` owns thin audit-view wiring for operator and worker paths.
   - Operator services expose `getAuditView(runId)` through the existing seam.
   - Worker services continue to emit the additive facts that the projection
     later correlates.
3. API, CLI, and web stay thin.
   - API exposes a run-scoped audit endpoint through the existing operator
     service.
   - CLI exposes a run-scoped audit read command.
   - Web only presents a minimal run-scoped audit section and does not become a
     dashboard product.
4. Replay stays the workflow source of truth.
   - Audit views never feed runtime transitions, replay reconstruction, or
     approval decisions.
   - Additive dispatch, worker, and tool facts remain optional audit context.

## Consequences

### Positive

- operators can inspect one run-scoped audit view instead of stitching together
  separate replay, dispatch, and tool-history reads
- inline and queued execution share one additive correlation model
- the repository can improve audit ergonomics without expanding into a full
  observability backend

### Negative

- correlated audit projections add another derived read model that must stay
  carefully separated from replay semantics
- cross-path correlation requires disciplined tests so additive facts do not
  appear required for workflow correctness
- web and API surfaces need restraint so thin operator views do not expand into
  analytics products

## Non-Goals

This ADR does not introduce:

- a full observability backend, log shipping, metrics, alerting, or SLO stack
- productized dashboards, cross-run analytics, or broad search UX
- replay reconstruction from correlated audit views
- default persistence of every provider-specific tool payload
- hosted queue operations, autoscaling, advanced scheduling, or broader
  platform work
- Phase 12 or later expansion
