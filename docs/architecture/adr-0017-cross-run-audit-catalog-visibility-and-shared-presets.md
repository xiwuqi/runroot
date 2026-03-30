# ADR-0017: Cross-Run Audit Catalog Visibility And Shared Presets

## Status

Accepted

## Context

Phase 16 introduced shared audit-view catalogs and curated operator presets.
That closed the gap where constrained saved views had to be reapplied through
surface-local bookmarks, but catalog entries were still just local curation
records. Operators could publish and reopen catalog entries, yet they still
lacked a shared, package-owned way to distinguish presets that stay personal
from presets intended to be reused through the same operator seams.

Runroot still needs a smaller next step than a collaborative catalog,
fine-grained RBAC platform, multi-tenant SaaS control plane, dashboard,
analytics suite, or search product:

- replay and approval remain workflow source of truth
- additive tool, worker, dispatch, saved-view, and catalog facts remain
  operator context
- catalog entries remain the reusable preset baseline
- API, CLI, SDK, and web remain thin operator surfaces

## Decision

Phase 17 adds a shared audit-catalog visibility contract plus thin
share/list-visible/inspect/unshare/apply paths.

1. `@runroot/replay` owns the shared visibility contract.
   - Visibility records reference an existing catalog entry through stable ids.
   - The contract stores only minimal visibility state plus ownership and scope
     references.
   - The contract does not snapshot audit facts, provider payloads,
     workflow-state models, or permission graphs.
2. `@runroot/persistence` owns additive visibility storage adapters.
   - File, SQLite, and Postgres adapters persist the same visibility shape.
   - Persistence remains additive and separate from replay, approval, runtime,
     and catalog publication transitions.
3. `@runroot/sdk` owns thin visibility wiring.
   - Operator services expose `shareCatalogEntry`, `listVisibleCatalogEntries`,
     `getCatalogVisibility`, `unshareCatalogEntry`, and a visibility-aware
     `applyCatalogEntry`.
   - Publishing a catalog entry seeds a personal visibility record for the
     current operator identity instead of expanding the catalog contract.
4. API, CLI, and web stay thin.
   - API exposes minimal visibility endpoints through the operator service.
   - CLI exposes thin `audit catalog visible|inspect|share|unshare|apply`
     commands.
   - Web presents a small visibility panel on the existing runs surface.
5. Replay and approval remain source of truth.
   - Visibility records never feed runtime transitions, replay reconstruction,
     or approval decisions.
   - Additive audit facts remain read-only operator context.

## Consequences

### Positive

- operators can distinguish personal presets from shared presets through the
  same package-owned seams
- inline and queued execution paths share one visibility model
- the repository closes a narrow shared-preset gap without expanding into a
  collaborative SaaS product or analytics surface

### Negative

- visibility adds another derived layer that must stay separated from replay
  and approval semantics
- the contract can drift toward RBAC, collaboration, or discovery products if
  ownership and scope metadata are allowed to expand
- legacy catalog entries only become visible through the Phase 17 path once
  explicit visibility metadata exists

## Non-Goals

This ADR does not introduce:

- a full observability backend, log shipping, metrics, alerting, or SLO stack
- productized dashboards, discovery products, broad analytics UX, or
  open-ended search products
- replay reconstruction from visibility records
- default persistence of every provider-specific payload or full audit snapshot
- fine-grained RBAC, org-directory management, or multi-tenant access control
- collaborative comments, review workflows, or broader multi-user curation
- hosted queue operations, autoscaling, advanced scheduling, or broader
  platform work
- Phase 18 or later expansion
