# Phase 20: Cross-Run Audit Catalog Assignment Checklists and Handoff Statuses

Status: repository-owned phase contract after scope freeze

This document records the repository-owned suggested execution contract for
Phase 20. It defines the minimum implementation boundary for a shared catalog
assignment-checklist layer over the existing saved-view, navigation,
drilldown, run-scoped audit, catalog, catalog-visibility, catalog-review-
signal, and catalog-review-assignment seams that already exist through the
shared operator surfaces.

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
- [docs/architecture/phase-19-handoff.md](./phase-19-handoff.md)
- [docs/guides/audit-view-catalogs.md](../guides/audit-view-catalogs.md)
- [docs/guides/audit-catalog-visibility.md](../guides/audit-catalog-visibility.md)
- [docs/guides/audit-catalog-review-signals.md](../guides/audit-catalog-review-signals.md)
- [docs/guides/audit-catalog-review-assignments.md](../guides/audit-catalog-review-assignments.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 19 closed the gap where reviewed visible presets could be handed off to
a specific operator through shared assignment metadata and an optional handoff
note. The next repository-owned gap is narrower than threaded collaboration,
review workflow engines, fine-grained RBAC, multi-tenant access,
productized discovery, or a collaborative SaaS catalog: handed-off presets
still do not carry a stable, package-owned way to represent thin checklist
items and an additive handoff status through the same seams.

The smallest next step is to add a shared assignment-checklist layer over the
existing review-assignment and review-signal path. This closes a thin
handoff-checklist gap without jumping into a threaded collaboration product,
review workflow engine, permission framework, dashboard, search product,
analytics suite, or multi-tenant control plane.

## Formal Name

- Primary name: `Cross-Run Audit Catalog Assignment Checklists and Handoff Statuses`
- Short label: `Assignment Checklists`

This is the suggested freeze name for Phase 20. If this document is merged, it
becomes the repository-owned formal Phase 20 name.

## Formal Goals

1. Add a shared audit-catalog assignment-checklist contract that lets existing
   assigned reviewed presets carry stable checklist items and handoff-status
   metadata through package-owned records, without snapshotting audit facts or
   redefining replay and approval source of truth.
2. Expose the minimum checklist, list-checklisted, inspect-checklist,
   clear-checklist, and apply paths needed for SDK, API, CLI, and web surfaces
   to reopen handoff checklists for assigned reviewed presets through the
   existing seams rather than app-owned storage reads or writes.
3. Allow inline and queued execution paths to participate in the same
   assignment-checklist rules without introducing a second runtime model,
   workflow-correctness layer, review workflow engine, permission framework,
   dashboard, or search engine.
4. Provide the minimum local-development and CI guidance needed to validate
   the shared assignment-checklist contract and thin operator-facing handoff
   checklist surfaces.
5. Document the observability, dashboard, analytics, search, threaded
   collaboration, RBAC, multi-tenant, and broader platform work that remains
   deferred beyond Phase 20.

## Formal Acceptance Standards

1. A shared audit-catalog assignment-checklist contract exists in packages and
   remains a derived layer over existing review-assignment, review-signal,
   catalog-visibility, catalog, saved-view, navigation, drilldown, and
   run-scoped audit reads.
2. Operators can add or update checklist items and handoff status on a visible
   assigned reviewed preset, list entries carrying checklist metadata, inspect
   checklist metadata, clear checklist metadata, and apply visible checklisted
   presets through stable references rather than surface-local state.
3. Existing operator surfaces can query or present those checklist paths
   through existing seams without introducing app-owned storage reads, direct
   writes, or a new orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. Checklist metadata stores only stable checklist status, minimal actor and
   scope references, optional thin checklist items, and existing
   review-assignment, review-signal, and catalog references rather than
   provider-specific payloads, workflow-state snapshots, or replay-derived
   correctness facts.
6. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the checklist path.
7. Local-development and CI guidance exists for the Phase 20 path.
8. Phase 20 naming is consistent across changed docs.
9. `pnpm lint` passes.
10. `pnpm typecheck` passes.
11. `pnpm test` passes.
12. `pnpm test:integration` passes.
13. `pnpm build` passes.
14. The phase does not introduce Phase 21 scope, a full observability backend,
    a productized dashboard, a collaborative SaaS catalog, or an open-ended
    search and analytics product.

## Formal Non-Goals

Phase 20 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, discovery portals, or
   open-ended search products.
3. Replacing replay with an assignment-checklist model or redefining additive
   audit facts as workflow-state source of truth.
4. Persisting every provider-specific tool payload or full audit fact
   snapshots by default.
5. Fine-grained RBAC beyond basic operator and admin role expectations.
6. Threaded comments, broader review workflow engines, or broader multi-user
   curation features around audit catalogs.
7. Multi-tenant SaaS catalog concerns, organization directories, billing, or
   broader hosted control-plane product work.
8. Checklist-driven approval gating, workflow orchestration, or new workflow
   templates.
9. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
10. Plugin, marketplace, or ecosystem packaging work.
11. Phase 21 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/persistence`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin assignment-checklist and handoff-status
  presentation and checklisted-preset application through existing API seams
- `packages/config` only if minimal checklist defaults need documentation or
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

1. Phases 2 through 19 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, cross-run audit query
   baseline, identifier-driven drilldown baseline, linked audit navigation
   baseline, saved-view baseline, catalog baseline, catalog-visibility
   baseline, catalog-review-signal baseline, and catalog-review-assignment
   baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support assignment checklists without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning assignment checklists into a second source of truth for
   replay or approval semantics.
2. Making additive checklist status or checklist items look required for
   workflow correctness rather than operator-facing audit context.
3. Expanding a checklist phase into a collaborative product, dashboard,
   analytics suite, search product, or permission platform effort.
4. Coupling the shared checklist contract too tightly to web route structure,
   storage layout, or indexing assumptions instead of keeping it as a stable
   read-model boundary.
5. Letting minimal checklist and handoff-status metadata pull in premature
   collaboration, RBAC, org-directory, or multi-tenant product scope.

## Must Be Deferred

The following remain out of scope for Phase 20:

1. Phase 21 or later product and platform expansion.
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
   handoff checklist path for this phase.
8. Plugin, marketplace, or broader ecosystem packaging work.
9. Broad event-model redesign beyond the additional derived assignment-
   checklist contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-20-assignment-checklists`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the assignment-checklist boundary
2. shared catalog assignment-checklist contract
3. persistence and thin API, CLI, SDK, and web checklist wiring
4. integration coverage for inline and queued checklist reads and writes
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the checklist persistence seam must land independently of the
  thin operator-facing handoff checklist surfaces.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 19

Phase 19 established a shared way to hand a reviewed visible preset to a
specific operator through additive assignment metadata and an optional handoff
note. Phase 20 builds on that foundation by adding a package-owned checklist
and handoff-status layer over assigned presets while preserving the same
source-of-truth boundary and keeping operator surfaces thin.

## Why This Is Phase 20

Once reviewed presets can be assigned to a specific operator, the next
repository-owned gap is not a threaded collaboration product, a fine-grained
RBAC system, or a multi-tenant control plane. It is the lack of a shared,
package-owned way to attach thin checklist items and a stable handoff status
to an assigned preset across operator surfaces. A thin checklist layer closes
that smaller gap before broader collaboration, RBAC, SaaS, dashboard, search,
or platform concerns that the repository still defers beyond this phase.

## Start Gate Before Phase 20 Execution

Before Phase 20 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 20 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 21 scope.
