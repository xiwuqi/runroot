# ADR-0014: Cross-Run Audit Navigation And Linked Operator Views

## Status

Accepted

## Context

Phase 13 introduced constrained, identifier-driven audit drilldowns. That
closed the thin drilldown gap, but operators still had to stitch together
summary results, drilldowns, and run-scoped audit views in surface-specific
ways.

Runroot needs a smaller next step than a dashboard or analytics product:

- replay and approval remain workflow source of truth
- additive tool, worker, and dispatch facts remain optional audit context
- navigation stays package-owned rather than pushing stitching logic into apps
- SDK, API, CLI, and web remain thin operator surfaces

## Decision

Phase 14 adds a shared cross-run audit navigation contract plus thin linked
operator-view paths.

1. `@runroot/replay` owns the shared navigation contract.
   - The contract links cross-run audit summaries, identifier-driven
     drilldowns, and existing run-scoped audit views through stable navigation
     references.
   - Navigation remains derived from existing summary, drilldown, and run-audit
     reads.
   - The contract does not expose provider-specific payloads or web-route
     structure.
2. `@runroot/sdk` owns thin navigation wiring.
   - Operator services expose `getAuditNavigation(filters?)`.
   - Wiring reuses existing runtime, dispatch, and tool-history seams instead
     of introducing a new orchestration model.
3. API, CLI, and web stay thin.
   - API exposes a single navigation endpoint through the existing operator
     service.
   - CLI exposes a thin `audit navigate` command.
   - Web presents minimal linked operator views on the existing runs surface.
4. Replay and approval remain source of truth.
   - Navigation reads never feed runtime transitions, replay reconstruction, or
     approval decisions.
   - Additive audit facts remain read-only operator context.

## Consequences

### Positive

- operators can move from summaries to constrained drilldowns and then to
  run-scoped audit views without surface-specific stitching
- inline and queued execution paths share one linked navigation model
- the repository closes an operator navigation gap without expanding into a
  dashboard, search, or analytics product

### Negative

- navigation adds another derived read model that must stay separated from
  replay semantics
- linked views can drift toward a dashboard if the contract is not kept narrow
- navigation links must avoid coupling to storage layout, indexing, or web
  route structure

## Non-Goals

This ADR does not introduce:

- a full observability backend, log shipping, metrics, alerting, or SLO stack
- productized dashboards, broad analytics UX, or open-ended search products
- replay reconstruction from linked navigation reads
- default persistence of every provider-specific tool payload
- hosted queue operations, autoscaling, advanced scheduling, or broader
  platform work
- Phase 15 or later expansion
