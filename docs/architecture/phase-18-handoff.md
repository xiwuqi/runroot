# Phase 18: Cross-Run Audit Catalog Review Signals and Shared Notes

Status: implemented on branch, pending phase review

This document records the repository-owned suggested execution contract for
Phase 18. It defines the minimum implementation boundary for a shared catalog
review-signal layer over the existing saved-view, navigation, drilldown,
run-scoped audit, catalog, and catalog-visibility seams that already exist
through the shared operator surfaces.

Primary source material:

- [docs/architecture/phase-0-blueprint.md](./phase-0-blueprint.md)
- [docs/architecture/replay-model.md](./replay-model.md)
- [docs/architecture/web-console.md](./web-console.md)
- [docs/architecture/observability.md](./observability.md)
- [docs/architecture/adr-0004-event-model-and-replay-source-of-truth.md](./adr-0004-event-model-and-replay-source-of-truth.md)
- [docs/architecture/adr-0008-web-console-and-observability-boundaries.md](./adr-0008-web-console-and-observability-boundaries.md)
- [docs/architecture/adr-0011-correlated-audit-projections-and-operator-views.md](./adr-0011-correlated-audit-projections-and-operator-views.md)
- [docs/architecture/adr-0012-cross-run-audit-queries-and-filters.md](./adr-0012-cross-run-audit-queries-and-filters.md)
- [docs/architecture/adr-0013-cross-run-audit-drilldowns-and-identifier-queries.md](./adr-0013-cross-run-audit-drilldowns-and-identifier-queries.md)
- [docs/architecture/adr-0014-cross-run-audit-navigation-and-linked-operator-views.md](./adr-0014-cross-run-audit-navigation-and-linked-operator-views.md)
- [docs/architecture/adr-0015-cross-run-audit-saved-views-and-operator-presets.md](./adr-0015-cross-run-audit-saved-views-and-operator-presets.md)
- [docs/architecture/adr-0016-cross-run-audit-view-catalogs-and-curated-operator-presets.md](./adr-0016-cross-run-audit-view-catalogs-and-curated-operator-presets.md)
- [docs/architecture/adr-0017-cross-run-audit-catalog-visibility-and-shared-presets.md](./adr-0017-cross-run-audit-catalog-visibility-and-shared-presets.md)
- [docs/architecture/phase-17-handoff.md](./phase-17-handoff.md)
- [docs/guides/audit-saved-views.md](../guides/audit-saved-views.md)
- [docs/guides/audit-view-catalogs.md](../guides/audit-view-catalogs.md)
- [docs/guides/audit-catalog-visibility.md](../guides/audit-catalog-visibility.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 17 closed the gap where curated presets could move between personal and
shared visibility through stable package-owned seams. The next
repository-owned gap is narrower than fine-grained RBAC, multi-tenant access,
productized discovery, or collaborative SaaS catalog work: visible presets
still do not carry a package-owned review-signal layer that lets operators
distinguish reviewed, recommended, or note-bearing presets from presets that
are only shared.

The smallest next step is to add a shared review-signal layer over existing
catalog visibility. This closes a thin curation gap without jumping into a
threaded collaboration product, permission framework, dashboard, search
product, or analytics platform.

## Formal Name

- Primary name: `Cross-Run Audit Catalog Review Signals and Shared Notes`
- Short label: `Catalog Review Signals`

This is the suggested freeze name for Phase 18. If this document is merged, it
becomes the repository-owned formal Phase 18 name.

## Formal Goals

1. Add a shared audit-catalog review-signal contract that lets existing visible
   catalog entries carry stable review state and an optional shared note
   through package-owned metadata, without snapshotting audit facts or
   redefining replay and approval source of truth.
2. Expose the minimum review, list-reviewed, inspect-review, clear-review, and
   apply paths needed for SDK, API, CLI, and web surfaces to reopen reviewed
   shared presets through the existing seams rather than app-owned storage
   reads or writes.
3. Allow inline and queued execution paths to participate in the same review
   rules without introducing a second runtime model, workflow correctness
   layer, permission framework, dashboard, or search engine.
4. Provide the minimum local-development and CI guidance needed to validate the
   shared review-signal contract and thin operator-facing review surfaces.
5. Document the observability, dashboard, analytics, search, threaded
   collaboration, RBAC, multi-tenant, and broader platform work that remains
   deferred beyond Phase 18.

## Formal Acceptance Standards

1. A shared audit-catalog review-signal contract exists in packages and remains
   a derived layer over existing catalog-visibility, catalog, saved-view,
   navigation, drilldown, and run-scoped audit reads.
2. Operators can set or update a thin review signal on visible catalog entries,
   list entries carrying review signals, inspect review metadata, clear review
   metadata, and apply visible reviewed presets through stable references
   rather than surface-local state.
3. Existing operator surfaces can query or present those review paths through
   existing seams without introducing app-owned storage reads, direct writes,
   or a new orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. Review metadata stores only stable review state, minimal actor or scope
   references, optional shared note text, and existing catalog references
   rather than provider-specific payloads, workflow-state snapshots, or
   replay-derived correctness facts.
6. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the review path.
7. Local-development and CI guidance exists for the Phase 18 path.
8. Phase 18 naming is consistent across changed docs.
9. `pnpm lint` passes.
10. `pnpm typecheck` passes.
11. `pnpm test` passes.
12. `pnpm test:integration` passes.
13. `pnpm build` passes.
14. The phase does not introduce Phase 19 scope, a full observability backend,
    a productized dashboard, a collaborative SaaS catalog, or an open-ended
    search and analytics product.

## Formal Non-Goals

Phase 18 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, discovery portals, or
   open-ended search products.
3. Replacing replay with a review-signal model or redefining additive audit
   facts as workflow-state source of truth.
4. Persisting every provider-specific tool payload or full audit fact snapshots
   by default.
5. Fine-grained RBAC beyond basic operator and admin role expectations.
6. Threaded comments, assignments, review workflows, or broader multi-user
   curation features around audit catalogs.
7. Multi-tenant SaaS catalog concerns, organization directories, billing, or
   broader hosted control-plane product work.
8. New workflow templates or unrelated API, CLI, or web product behavior.
9. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
10. Plugin, marketplace, or ecosystem packaging work.
11. Phase 19 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/persistence`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin review-signal and shared-note presentation and
  shared-preset application through existing API seams
- `packages/config` only if minimal review defaults need documentation or
  exposure
- docs and minimal local-development configuration

Optional thin-touch areas only if implementation requires them:

- `packages/observability`
- `packages/events`
- `apps/worker`

Default non-targets:

- new templates
- product-surface redesign
- unrelated runtime, queue, or persistence refactors
- broad observability backend vendor integrations

## Preconditions

1. Phases 2 through 17 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, cross-run audit query
   baseline, identifier-driven drilldown baseline, linked audit navigation
   baseline, saved-view baseline, catalog baseline, and catalog-visibility
   baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support catalog review signals without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning catalog review signals into a second source of truth
   for replay or approval semantics.
2. Making additive review notes or review states look required for workflow
   correctness rather than operator-facing audit context.
3. Expanding a review-signal phase into a collaborative product, dashboard,
   analytics suite, search product, or backend platform effort.
4. Coupling the shared review contract too tightly to web route structure,
   storage layout, or indexing assumptions instead of keeping it as a stable
   read-model boundary.
5. Letting minimal note or reviewer metadata pull in premature collaboration,
   RBAC, org-directory, or multi-tenant product scope.

## Must Be Deferred

The following remain out of scope for Phase 18:

1. Phase 19 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, broad analytics UX, discovery
   products, or open-ended search products.
4. Persisting every provider-specific tool payload or every derived audit fact
   snapshot by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. Fine-grained RBAC, organization or team management, multi-tenant access
   models, or broader SaaS product concerns.
7. Threaded collaborative comments, assignments, review flows, or broader
   multi-user curation beyond the minimum review-signal path for this phase.
8. Plugin, marketplace, or broader ecosystem packaging work.
9. Broad event-model redesign beyond the additional derived review contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-18-catalog-review-signals`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the review-signal boundary
2. shared catalog review-signal contract
3. persistence and thin API, CLI, SDK, and web review wiring
4. integration coverage for inline and queued review reads and writes
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the review persistence seam must land independently of the
  thin operator-facing review surfaces.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 17

Phase 17 established a shared way to distinguish personal presets from shared
presets across operator surfaces. Phase 18 builds on that foundation by adding
a package-owned review-signal and shared-note layer over visible presets while
preserving the same source-of-truth boundary and keeping operator surfaces
thin.

## Why This Is Phase 18

Once visible shared presets exist, the next repository-owned gap is not a full
RBAC system, multi-tenant SaaS control plane, or discovery and analytics
product. It is the lack of a thin shared recommendation and note layer for
those visible presets across operator surfaces. A review-signal layer closes
that smaller curation gap before broader RBAC, collaboration, SaaS, dashboard,
search, or platform concerns that the repository still defers beyond this
phase.

## Start Gate Before Phase 18 Execution

Before Phase 18 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 18 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 19 scope.
