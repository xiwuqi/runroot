# ADR-0015: Cross-Run Audit Saved Views And Operator Presets

## Status

Accepted

## Context

Phase 14 introduced linked navigation between cross-run summaries,
identifier-driven drilldowns, and existing run-scoped audit views. That closed
the thin navigation gap, but operators still had to copy URLs or manually
re-enter the same constrained filters when they wanted to revisit an
investigation later.

Runroot needs a smaller next step than a dashboard, analytics suite, or shared
catalog product:

- replay and approval remain workflow source of truth
- additive tool, worker, and dispatch facts remain optional audit context
- saved views stay package-owned rather than pushing storage reads into apps
- SDK, API, CLI, and web remain thin operator surfaces

## Decision

Phase 15 adds a shared saved-view and operator-preset contract plus thin
save/list/load/apply paths.

1. `@runroot/replay` owns the shared saved-view contract.
   - The contract stores constrained audit navigation state and stable
     navigation references.
   - The contract does not snapshot audit facts, provider payloads, or
     workflow-state models.
   - Applying a saved view reuses the existing navigation query instead of
     introducing a new orchestration layer.
2. `@runroot/persistence` owns additive saved-view storage adapters.
   - File, SQLite, and Postgres adapters persist the same saved-view shape.
   - Persistence remains additive and separate from replay, approval, and
     runtime transitions.
3. `@runroot/sdk` owns thin saved-view wiring.
   - Operator services expose `saveSavedView`, `listSavedViews`,
     `getSavedView`, and `applySavedView`.
   - Wiring reuses the existing runtime, dispatch, tool-history, and
     navigation seams.
4. API, CLI, and web stay thin.
   - API exposes minimal save/list/load/apply endpoints through the operator
     service.
   - CLI exposes thin `audit saved-views ...` commands.
   - Web presents a small saved-view panel on the existing runs surface.
5. Replay and approval remain source of truth.
   - Saved views never feed runtime transitions, replay reconstruction, or
     approval decisions.
   - Additive audit facts remain read-only operator context.

## Consequences

### Positive

- operators can reopen constrained audit investigations without surface-owned
  bookmark formats
- inline and queued execution paths share one saved-view model
- the repository closes an operator workflow gap without expanding into a
  dashboard, analytics product, or collaborative catalog

### Negative

- saved views add another derived layer that must stay separated from replay
  semantics
- the contract can drift toward a catalog or dashboard if save/apply scope is
  not kept narrow
- persistence must avoid coupling saved views to web routes, storage layout, or
  indexing assumptions

## Non-Goals

This ADR does not introduce:

- a full observability backend, log shipping, metrics, alerting, or SLO stack
- productized dashboards, broad analytics UX, or open-ended search products
- replay reconstruction from saved-view records
- default persistence of every provider-specific payload or full audit snapshot
- collaborative sharing, RBAC, SaaS catalogs, or multi-tenant saved-view
  concerns
- hosted queue operations, autoscaling, advanced scheduling, or broader
  platform work
- Phase 16 or later expansion
