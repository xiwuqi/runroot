# Phase 17: Cross-Run Audit Catalog Visibility and Shared Presets

Status: implemented on branch, pending phase review

This document records the repository-owned suggested execution contract for
Phase 17. It defines the minimum implementation boundary for a shared catalog
visibility layer over the existing saved-view, navigation, drilldown,
run-scoped audit, and catalog seams that already exist through the shared
operator surfaces.

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
- [docs/architecture/phase-16-handoff.md](./phase-16-handoff.md)
- [docs/guides/audit-navigation.md](../guides/audit-navigation.md)
- [docs/guides/audit-saved-views.md](../guides/audit-saved-views.md)
- [docs/guides/audit-view-catalogs.md](../guides/audit-view-catalogs.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 16 closed the gap where constrained saved views could be turned into a
shared, package-owned catalog of reusable presets. The next repository-owned
gap is that those catalog entries are still effectively local curation records:
they can be published and reopened, but they do not yet carry a package-owned
visibility model that lets operators distinguish personal presets from presets
intended to be reused by other operators through the same seams.

The smallest next step is to add a shared catalog-visibility layer over the
existing catalog path. This closes a narrow sharing and visibility gap without
jumping into a collaborative catalog product, fine-grained RBAC platform,
multi-tenant SaaS surface, productized dashboard, or open-ended search and
analytics product.

## Formal Name

- Primary name: `Cross-Run Audit Catalog Visibility and Shared Presets`
- Short label: `Catalog Visibility`

This is the suggested freeze name for Phase 17. If this document is merged, it
becomes the repository-owned formal Phase 17 name.

## Formal Goals

1. Add a shared audit-catalog visibility contract that lets existing catalog
   entries move between personal and shared visibility states through stable
   metadata and visibility references, without snapshotting audit facts or
   redefining replay and approval source of truth.
2. Expose the minimum share, list-visible, inspect, unshare, and apply paths
   needed for SDK, API, CLI, and web surfaces to reopen shared presets through
   the existing seams rather than app-owned storage reads or writes.
3. Allow inline and queued execution paths to participate in the same catalog
   visibility rules without introducing a second runtime model, workflow
   correctness layer, dashboard, or search engine.
4. Provide the minimum local-development and CI guidance needed to validate the
   shared visibility contract and thin operator-facing shared-preset surfaces.
5. Document the observability, dashboard, analytics, search, collaborative
   curation, RBAC, multi-tenant, and broader platform work that remains
   deferred beyond Phase 17.

## Formal Acceptance Standards

1. A shared audit-catalog visibility contract exists in packages and remains a
   derived layer over existing catalog, saved-view, navigation, drilldown, and
   run-scoped audit reads.
2. Operators can mark catalog entries as shared or personal, list the entries
   visible through the current visibility rules, inspect visibility metadata,
   withdraw shared visibility, and apply visible shared presets through stable
   filters and references rather than surface-local sharing formats.
3. Existing operator surfaces can query or present those visibility paths
   through existing seams without introducing app-owned storage reads, direct
   writes, or a new orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. Visibility metadata stores only stable visibility state, minimal ownership
   or scope references, and existing catalog references rather than
   provider-specific payloads, workflow-state snapshots, or replay-derived
   correctness facts.
6. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the visibility path.
7. Local-development and CI guidance exists for the Phase 17 path.
8. Phase 17 naming is consistent across changed docs.
9. `pnpm lint` passes.
10. `pnpm typecheck` passes.
11. `pnpm test` passes.
12. `pnpm test:integration` passes.
13. `pnpm build` passes.
14. The phase does not introduce Phase 18 scope, a full observability backend,
    a productized dashboard, a collaborative SaaS catalog, or an open-ended
    search and analytics product.

## Formal Non-Goals

Phase 17 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, discovery portals, or
   open-ended search products.
3. Replacing replay with a catalog-visibility model or redefining additive
   audit facts as workflow-state source of truth.
4. Persisting every provider-specific tool payload or full audit fact snapshots
   by default.
5. Fine-grained RBAC beyond basic operator and admin role expectations.
6. Collaborative comments, review workflows, or broader multi-user curation
   features around audit catalogs.
7. Multi-tenant SaaS catalog concerns, organization directories, billing, or
   broader hosted control-plane product work.
8. New workflow templates or unrelated API, CLI, or web product behavior.
9. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
10. Plugin, marketplace, or ecosystem packaging work.
11. Phase 18 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/persistence`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin visibility presentation and shared-preset
  application through existing API seams
- `packages/config` only if minimal visibility defaults need documentation or
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

1. Phases 2 through 16 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, cross-run audit query
   baseline, identifier-driven drilldown baseline, linked audit navigation
   baseline, saved-view baseline, and catalog baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support catalog visibility without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning catalog visibility into a second source of truth for
   replay or approval semantics.
2. Making additive tool, worker, or dispatch facts look required for workflow
   correctness rather than operator-facing audit context.
3. Expanding a visibility phase into a collaborative product, dashboard,
   analytics suite, search product, or backend platform effort.
4. Coupling the shared visibility contract too tightly to web route structure,
   storage layout, or indexing assumptions instead of keeping it as a stable
   read-model boundary.
5. Letting minimal visibility metadata pull in premature collaboration, RBAC,
   org-directory, or multi-tenant product scope.

## Must Be Deferred

The following remain out of scope for Phase 17:

1. Phase 18 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, broad analytics UX, discovery
   products, or open-ended search products.
4. Persisting every provider-specific tool payload or every derived audit fact
   snapshot by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. Fine-grained RBAC, organization or team management, multi-tenant access
   models, or broader SaaS product concerns.
7. Collaborative audit-catalog comments, review flows, or multi-user curation
   beyond the minimum shared visibility path for this phase.
8. Plugin, marketplace, or broader ecosystem packaging work.
9. Broad event-model redesign beyond the additional derived visibility
   contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-17-catalog-visibility`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the visibility boundary
2. shared catalog-visibility contract
3. persistence and thin API, CLI, SDK, and web visibility wiring
4. integration coverage for inline and queued visibility reads and writes
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the visibility persistence seam must land independently of the
  thin operator-facing visibility surfaces.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 16

Phase 16 established a shared way to publish constrained saved views into a
catalog of reusable presets. Phase 17 builds on that foundation by adding a
package-owned visibility model that distinguishes personal presets from shared
presets while preserving the same source-of-truth boundary and keeping
operator surfaces thin.

## Why This Is Phase 17

Once operators can publish and reopen curated catalog entries, the next
repository-owned gap is not a full collaborative product or analytics suite.
It is the lack of a shared, package-owned visibility model for those curated
presets across operator surfaces. A thin visibility layer closes that gap
before broader RBAC, multi-user curation, SaaS, dashboard, search, or
platform concerns that the repository still defers beyond this phase.

## Start Gate Before Phase 17 Execution

Before Phase 17 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 17 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 18 scope.
