# ADR-0016: Cross-Run Audit View Catalogs And Curated Operator Presets

## Status

Accepted

## Context

Phase 15 introduced shared saved audit views and operator presets. That closed
the gap where constrained investigations had to be recreated from copied URLs
or surface-local bookmarks, but operators still lacked a shared, package-owned
way to curate a small reusable set of those views across SDK, API, CLI, and
web surfaces.

Runroot still needs a smaller next step than a collaborative catalog,
dashboard, analytics suite, or open-ended search product:

- replay and approval remain workflow source of truth
- additive tool, worker, and dispatch facts remain optional audit context
- saved views remain the constrained base layer
- API, CLI, SDK, and web remain thin operator surfaces

## Decision

Phase 16 adds a shared audit-view catalog contract plus thin
publish/list/inspect/archive/apply paths.

1. `@runroot/replay` owns the shared catalog contract.
   - Catalog entries publish existing constrained saved views through stable
     metadata and saved-view references.
   - The contract stores only minimal metadata plus stable references to an
     existing saved view.
   - The contract does not snapshot audit facts, provider payloads, or
     workflow-state models.
2. `@runroot/persistence` owns additive catalog storage adapters.
   - File, SQLite, and Postgres adapters persist the same catalog-entry shape.
   - Persistence remains additive and separate from replay, approval, and
     runtime transitions.
3. `@runroot/sdk` owns thin catalog wiring.
   - Operator services expose `publishCatalogEntry`, `listCatalogEntries`,
     `getCatalogEntry`, `archiveCatalogEntry`, and `applyCatalogEntry`.
   - Wiring reuses the existing saved-view, navigation, runtime, dispatch, and
     tool-history seams.
4. API, CLI, and web stay thin.
   - API exposes minimal catalog endpoints through the operator service.
   - CLI exposes thin `audit catalog ...` commands.
   - Web presents a small catalog panel on the existing runs surface.
5. Replay and approval remain source of truth.
   - Catalog entries never feed runtime transitions, replay reconstruction, or
     approval decisions.
   - Additive audit facts remain read-only operator context.

## Consequences

### Positive

- operators can promote constrained saved views into reusable catalog entries
  across surfaces
- inline and queued execution paths share one catalog model
- the repository closes a discoverability gap without expanding into a
  collaborative product or analytics surface

### Negative

- catalogs add another derived layer that must stay separated from replay and
  approval semantics
- the contract can drift toward a dashboard, discovery product, or
  collaboration surface if publication and metadata scope are not kept narrow
- persistence must avoid coupling catalog entries to web routes, storage
  layout, or indexing assumptions

## Non-Goals

This ADR does not introduce:

- a full observability backend, log shipping, metrics, alerting, or SLO stack
- productized dashboards, broad analytics UX, or open-ended search products
- replay reconstruction from catalog records
- default persistence of every provider-specific payload or full audit snapshot
- collaborative sharing, RBAC, SaaS catalogs, or multi-user curation
- hosted queue operations, autoscaling, advanced scheduling, or broader
  platform work
- Phase 17 or later expansion
