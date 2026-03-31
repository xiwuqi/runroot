# Phase 21: Cross-Run Audit Catalog Checklist Item Progress and Completion Notes

Status: repository-owned phase contract after scope freeze

This document records the repository-owned suggested execution contract for
Phase 21. It defines the minimum implementation boundary for a shared catalog
checklist-item-progress layer over the existing saved-view, navigation,
drilldown, run-scoped audit, catalog, catalog-visibility, catalog-review-
signal, catalog-review-assignment, and assignment-checklist seams that already
exist through the shared operator surfaces.

Primary source material:

- [docs/architecture/phase-0-blueprint.md](./phase-0-blueprint.md)
- [docs/architecture/replay-model.md](./replay-model.md)
- [docs/architecture/web-console.md](./web-console.md)
- [docs/architecture/observability.md](./observability.md)
- [docs/architecture/extension-model.md](./extension-model.md)
- [docs/architecture/adr-0004-event-model-and-replay-source-of-truth.md](./adr-0004-event-model-and-replay-source-of-truth.md)
- [docs/architecture/adr-0008-web-console-and-observability-boundaries.md](./adr-0008-web-console-and-observability-boundaries.md)
- [docs/architecture/adr-0011-correlated-audit-projections-and-operator-views.md](./adr-0011-correlated-audit-projections-and-operator-views.md)
- [docs/architecture/adr-0012-cross-run-audit-queries-and-filters.md](./adr-0012-cross-run-audit-queries-and-filters.md)
- [docs/architecture/adr-0013-cross-run-audit-drilldowns-and-identifier-queries.md](./adr-0013-cross-run-audit-drilldowns-and-identifier-queries.md)
- [docs/architecture/adr-0014-cross-run-audit-navigation-and-linked-operator-views.md](./adr-0014-cross-run-audit-navigation-and-linked-operator-views.md)
- [docs/architecture/adr-0015-cross-run-audit-saved-views-and-operator-presets.md](./adr-0015-cross-run-audit-saved-views-and-operator-presets.md)
- [docs/architecture/adr-0016-cross-run-audit-view-catalogs-and-curated-operator-presets.md](./adr-0016-cross-run-audit-view-catalogs-and-curated-operator-presets.md)
- [docs/architecture/adr-0017-cross-run-audit-catalog-visibility-and-shared-presets.md](./adr-0017-cross-run-audit-catalog-visibility-and-shared-presets.md)
- [docs/architecture/adr-0018-cross-run-audit-catalog-review-signals-and-shared-notes.md](./adr-0018-cross-run-audit-catalog-review-signals-and-shared-notes.md)
- [docs/architecture/adr-0019-cross-run-audit-catalog-review-assignments-and-operator-handoffs.md](./adr-0019-cross-run-audit-catalog-review-assignments-and-operator-handoffs.md)
- [docs/architecture/adr-0020-cross-run-audit-catalog-assignment-checklists-and-handoff-statuses.md](./adr-0020-cross-run-audit-catalog-assignment-checklists-and-handoff-statuses.md)
- [docs/architecture/phase-20-handoff.md](./phase-20-handoff.md)
- [docs/guides/audit-view-catalogs.md](../guides/audit-view-catalogs.md)
- [docs/guides/audit-catalog-visibility.md](../guides/audit-catalog-visibility.md)
- [docs/guides/audit-catalog-review-signals.md](../guides/audit-catalog-review-signals.md)
- [docs/guides/audit-catalog-review-assignments.md](../guides/audit-catalog-review-assignments.md)
- [docs/guides/audit-catalog-assignment-checklists.md](../guides/audit-catalog-assignment-checklists.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 20 closed the gap where assigned reviewed presets could carry thin
checklist items and a stable handoff status through package-owned seams. The
next repository-owned gap is narrower than threaded collaboration, broader
review workflow engines, fine-grained RBAC, multi-tenant access,
productized discovery, or a collaborative SaaS catalog: handed-off presets
still do not carry a stable, package-owned way to record thin per-item
checklist progress and a single completion note through the same seams.

The smallest next step is to add a shared checklist-item-progress layer over
the existing assignment-checklist and review-assignment path. This closes a
thin progress-tracking gap without jumping into a threaded collaboration
product, broader checklist orchestration engine, permission framework,
dashboard, search product, analytics suite, or multi-tenant control plane.

## Formal Name

- Primary name: `Cross-Run Audit Catalog Checklist Item Progress and Completion Notes`
- Short label: `Checklist Item Progress`

This is the suggested freeze name for Phase 21. If this document is merged, it
becomes the repository-owned formal Phase 21 name.

## Formal Goals

1. Add a shared audit-catalog checklist-item-progress contract that lets
   existing assigned reviewed presets carry stable per-item progress and a thin
   completion note through package-owned records, without snapshotting audit
   facts or redefining replay and approval source of truth.
2. Expose the minimum progress, list-progressed, inspect-progress,
   clear-progress, and apply paths needed for SDK, API, CLI, and web surfaces
   to reopen checklist progress for assigned reviewed presets through the
   existing seams rather than app-owned storage reads or writes.
3. Allow inline and queued execution paths to participate in the same
   checklist-item-progress rules without introducing a second runtime model,
   workflow-correctness layer, broader checklist orchestration engine,
   permission framework, dashboard, or search engine.
4. Provide the minimum local-development and CI guidance needed to validate
   the shared checklist-item-progress contract and thin operator-facing
   completion-note surfaces.
5. Document the observability, dashboard, analytics, search, threaded
   collaboration, RBAC, multi-tenant, and broader platform work that remains
   deferred beyond Phase 21.

## Formal Acceptance Standards

1. A shared audit-catalog checklist-item-progress contract exists in packages
   and remains a derived layer over existing assignment-checklist,
   review-assignment, review-signal, catalog-visibility, catalog, saved-view,
   navigation, drilldown, and run-scoped audit reads.
2. Operators can add or update thin per-item checklist progress and an
   optional completion note on a visible assigned reviewed preset, list entries
   carrying progress metadata, inspect progress metadata, clear progress
   metadata, and apply visible progressed presets through stable references
   rather than surface-local state.
3. Existing operator surfaces can query or present those progress paths
   through existing seams without introducing app-owned storage reads, direct
   writes, or a new orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. Progress metadata stores only stable per-item progress state, minimal actor
   and scope references, an optional thin completion note, and existing
   assignment-checklist, review-assignment, review-signal, and catalog
   references rather than provider-specific payloads, workflow-state
   snapshots, or replay-derived correctness facts.
6. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the checklist-item-progress path.
7. Local-development and CI guidance exists for the Phase 21 path.
8. Phase 21 naming is consistent across changed docs.
9. `pnpm lint` passes.
10. `pnpm typecheck` passes.
11. `pnpm test` passes.
12. `pnpm test:integration` passes.
13. `pnpm build` passes.
14. The phase does not introduce Phase 22 scope, a full observability backend,
    a productized dashboard, a collaborative SaaS catalog, or an open-ended
    search and analytics product.

## Formal Non-Goals

Phase 21 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, discovery portals, or
   open-ended search products.
3. Replacing replay with a checklist-item-progress model or redefining
   additive audit facts as workflow-state source of truth.
4. Persisting every provider-specific tool payload or full audit fact
   snapshots by default.
5. Fine-grained RBAC beyond basic operator and admin role expectations.
6. Threaded comments, broader review workflow engines, broader checklist
   orchestration, or broader multi-user curation features around audit
   catalogs.
7. Multi-tenant SaaS catalog concerns, organization directories, billing, or
   broader hosted control-plane product work.
8. Checklist-item-driven approval gating, workflow orchestration, or new
   workflow templates.
9. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
10. Plugin, marketplace, or ecosystem packaging work.
11. Phase 22 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/persistence`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin checklist-item-progress and completion-note
  presentation and progressed-preset application through existing API seams
- `packages/config` only if minimal progress defaults need documentation or
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

1. Phases 2 through 20 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, cross-run audit query
   baseline, identifier-driven drilldown baseline, linked audit navigation
   baseline, saved-view baseline, catalog baseline, catalog-visibility
   baseline, catalog-review-signal baseline, catalog-review-assignment
   baseline, and assignment-checklist baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support checklist item progress without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning checklist item progress into a second source of truth
   for replay or approval semantics.
2. Making additive per-item progress or completion notes look required for
   workflow correctness rather than operator-facing audit context.
3. Expanding a progress phase into a collaborative product, dashboard,
   analytics suite, search product, or permission platform effort.
4. Coupling the shared progress contract too tightly to web route structure,
   storage layout, or indexing assumptions instead of keeping it as a stable
   read-model boundary.
5. Letting minimal per-item progress or completion-note metadata pull in
   premature collaboration, RBAC, org-directory, or multi-tenant product
   scope.

## Must Be Deferred

The following remain out of scope for Phase 21:

1. Phase 22 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, broad analytics UX, discovery
   products, or open-ended search products.
4. Persisting every provider-specific tool payload or every derived audit fact
   snapshot by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. Fine-grained RBAC, organization or team management, multi-tenant access
   models, or broader SaaS product concerns.
7. Threaded collaborative comments, broader review workflow engines, broader
   checklist orchestration, or broader multi-user curation beyond the minimum
   checklist-item-progress path for this phase.
8. Plugin, marketplace, or broader ecosystem packaging work.
9. Broad event-model redesign beyond the additional derived checklist-item-
   progress contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-21-checklist-item-progress`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the checklist-item-progress boundary
2. shared catalog checklist-item-progress contract
3. persistence and thin API, CLI, SDK, and web progress wiring
4. integration coverage for inline and queued progress reads and writes
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the progress persistence seam must land independently of the
  thin operator-facing completion-note surfaces.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 20

Phase 20 established a shared way to attach thin checklist items and a stable
handoff status to an assigned reviewed preset. Phase 21 builds on that
foundation by adding a package-owned way to record per-item checklist progress
and a thin completion note over that same assigned preset while preserving the
same source-of-truth boundary and keeping operator surfaces thin.

## Why This Is Phase 21

Once assigned reviewed presets can carry checklist items and an overall status,
the next repository-owned gap is not a threaded collaboration product, a
broader review workflow engine, a fine-grained RBAC system, or a multi-tenant
control plane. It is the lack of a shared, package-owned way to reopen and
record thin per-item progress and a single completion note across operator
surfaces. A thin progress layer closes that smaller gap before broader
checklist orchestration, threaded collaboration, RBAC, SaaS, dashboard,
search, or platform concerns that the repository still defers beyond this
phase.

## Start Gate Before Phase 21 Execution

Before Phase 21 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 21 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 22 scope.
