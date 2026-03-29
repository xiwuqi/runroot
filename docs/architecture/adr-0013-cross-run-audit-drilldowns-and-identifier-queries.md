# ADR-0013: Cross-Run Audit Drilldowns And Identifier Queries

## Status

Accepted

## Context

Phase 12 introduced a shared cross-run audit query and filter contract. That
closed the thin list-and-filter gap, but operators still had to manually stitch
together per-run audit views when they wanted to follow a stable identifier
such as an approval, step, dispatch job, worker, tool call, or tool ID.

Runroot needs a minimal next step that stays derived and operator-facing:

- replay and approval remain the workflow source of truth
- additive tool, worker, and dispatch facts remain optional audit context
- identifier-driven drilldowns stay package-owned rather than moving read logic
  into apps
- API, CLI, SDK, and web remain thin operator surfaces instead of becoming
  dashboard, analytics, or search products

## Decision

Phase 13 adds a shared cross-run audit drilldown and identifier-query contract
plus thin operator-facing drilldown paths.

1. `@runroot/replay` owns the shared identifier-driven drilldown contract.
   - The contract returns run-scoped drilldown results constrained by stable
     identifiers such as run, approval, step, dispatch job, worker, tool call,
     and tool identifiers.
   - Drilldown reads stay derived from existing run-scoped audit views and do
     not redefine workflow correctness.
   - Empty drilldown requests stay constrained and do not degrade into broad,
     open-ended search.
2. `@runroot/sdk` owns thin drilldown wiring.
   - Operator services expose `listAuditDrilldowns(filters?)`.
   - Wiring may reuse existing runtime, dispatch, and tool-history seams, but
     it does not introduce a new orchestration model.
3. API, CLI, and web stay thin.
   - API exposes a single drilldown endpoint through the existing operator
     service.
   - CLI exposes a thin `audit drilldown` command.
   - Web adds minimal drilldown presentation on the existing runs surface and
     does not become a dashboard or analytics product.
4. Replay and approval remain source of truth.
   - Drilldown reads never feed runtime transitions, replay reconstruction, or
     approval decisions.
   - Additive tool, worker, and dispatch facts remain read-only operator
     context.

## Consequences

### Positive

- operators can pivot from cross-run summaries through stable identifiers
  without manual stitching
- inline and queued execution paths share one constrained drilldown model
- the repository closes an operator exploration gap without expanding into a
  dashboard or analytics platform

### Negative

- identifier-driven drilldowns add another derived read model that must stay
  clearly separated from replay semantics
- even a constrained drilldown surface can drift toward productized search if
  not kept under review
- drilldown results must avoid coupling to storage layout, indexing, or web
  route structure

## Non-Goals

This ADR does not introduce:

- a full observability backend, log shipping, metrics, alerting, or SLO stack
- productized dashboards, broad analytics UX, or open-ended search products
- replay reconstruction from identifier-driven drilldowns
- default persistence of every provider-specific tool payload
- hosted queue operations, autoscaling, advanced scheduling, or broader
  platform work
- Phase 14 or later expansion
