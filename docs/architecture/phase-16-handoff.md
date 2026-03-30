# Phase 16: Cross-Run Audit View Catalogs and Curated Operator Presets

Status: proposed for scope freeze, implementation not started

This document proposes the repository-owned Phase 16 execution contract for
Runroot. It defines the minimum implementation boundary for a shared audit-view
catalog over the existing saved-view, navigation, drilldown, and run-scoped
audit seams that already exist through the shared operator surfaces.

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
- [docs/architecture/phase-15-handoff.md](./phase-15-handoff.md)
- [docs/guides/audit-queries.md](../guides/audit-queries.md)
- [docs/guides/audit-drilldowns.md](../guides/audit-drilldowns.md)
- [docs/guides/audit-navigation.md](../guides/audit-navigation.md)
- [docs/guides/audit-saved-views.md](../guides/audit-saved-views.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 15 closed the gap where operators needed a shared, repository-owned way
to save and reopen constrained audit investigations. The next repository-owned
operator gap is that those saved views still live as point entries with thin
list semantics. Surfaces do not yet share a package-owned way to curate a
small catalog of reusable audit presets that operators can discover and reopen
without surface-local conventions.

The smallest next step is to add a shared catalog layer over existing saved
views. This closes a narrow operator workflow gap without jumping into a
productized dashboard, broad analytics UX, open-ended search product, or
collaborative SaaS catalog.

## Formal Name

- Primary name: `Cross-Run Audit View Catalogs and Curated Operator Presets`
- Short label: `Audit View Catalogs`

This is the suggested freeze name for Phase 16. If this document is merged, it
becomes the repository-owned formal Phase 16 name.

## Formal Goals

1. Add a shared audit-view catalog contract that promotes existing constrained
   saved views into reusable catalog entries through stable metadata and
   references, without snapshotting audit facts or redefining replay and
   approval source of truth.
2. Expose the minimum publish, list, inspect, archive, and apply paths needed
   for SDK, API, CLI, and web surfaces to discover and reopen curated audit
   presets through the existing seams rather than app-owned storage reads.
3. Allow inline and queued execution paths to participate in the same catalog
   rules without introducing a second runtime model, search engine, or
   workflow-correctness layer.
4. Provide the minimum local-development and CI guidance needed to validate
   the shared catalog contract and thin operator-facing catalog surfaces.
5. Document the observability, dashboard, analytics, search, collaboration,
   RBAC, and broader platform work that remains deferred beyond Phase 16.

## Formal Acceptance Standards

1. A shared audit-view catalog contract exists in packages and remains a
   derived layer over existing saved-view, navigation, drilldown, and
   run-scoped audit reads.
2. Operators can publish constrained saved views into catalog entries, list
   catalog entries, inspect catalog metadata, archive catalog entries, and
   apply catalog-backed presets through stable filters and references rather
   than surface-local bookmark formats.
3. Existing operator surfaces can query or present those catalog paths through
   existing seams without introducing app-owned storage reads, direct writes,
   or a new orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. Catalog entries store stable filters, navigation references, and minimal
   catalog metadata rather than provider-specific payloads, workflow-state
   snapshots, or replay-derived correctness facts.
6. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the catalog path.
7. Local-development and CI guidance exists for the Phase 16 path.
8. Phase 16 naming is consistent across changed docs.
9. `pnpm lint` passes.
10. `pnpm typecheck` passes.
11. `pnpm test` passes.
12. `pnpm test:integration` passes.
13. `pnpm build` passes.
14. The phase does not introduce Phase 17 scope, a full observability backend,
    a productized dashboard, or an open-ended search and analytics product.

## Formal Non-Goals

Phase 16 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, or open-ended search products.
3. Replacing replay with a catalog model or redefining additive audit facts as
   workflow-state source of truth.
4. Persisting every provider-specific tool payload or full audit fact snapshots
   by default.
5. Collaborative sharing, multi-user curation, RBAC-governed access, or
   broader SaaS product concerns around audit-view catalogs.
6. New workflow templates or unrelated API, CLI, or web product behavior.
7. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
8. Plugin, marketplace, or ecosystem packaging work.
9. Phase 17 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/persistence`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin catalog presentation and catalog-backed preset
  application through existing API seams
- `packages/config` only if minimal catalog defaults or preset visibility
  settings need documentation or exposure
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

1. Phases 2 through 15 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, cross-run audit query
   baseline, identifier-driven drilldown baseline, linked audit navigation
   baseline, and saved-view baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support catalog entries without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning audit-view catalogs into a second source of truth for
   replay or approval semantics.
2. Making additive tool, worker, or dispatch facts look required for workflow
   correctness rather than operator-facing audit context.
3. Expanding a catalog phase into a dashboard, analytics, search, or backend
   platform effort.
4. Coupling the shared catalog contract too tightly to web route structure,
   storage layout, or indexing assumptions instead of keeping it as a stable
   read-model boundary.
5. Letting catalog metadata pull in premature collaboration, RBAC, or
   multi-tenant product scope.

## Must Be Deferred

The following remain out of scope for Phase 16:

1. Phase 17 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, broad analytics UX, or open-ended
   search products.
4. Persisting every provider-specific tool payload or every derived audit fact
   snapshot by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. Collaborative audit-view catalogs, RBAC-governed sharing, multi-user
   curation, or broader operator product surfaces beyond the minimum catalog
   path for this phase.
7. Plugin, marketplace, or broader ecosystem packaging work.
8. Broad event-model redesign beyond the additional derived catalog contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-16-audit-view-catalogs`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the catalog boundary
2. shared audit-view catalog contract
3. persistence and thin API, CLI, SDK, and web catalog wiring
4. integration coverage for inline and queued catalog reads and writes
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the catalog persistence seam must land independently of the
  thin operator-facing catalog surfaces.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 15

Phase 15 established a shared way to save, list, load, and apply constrained
audit views. Phase 16 builds on that foundation by turning a subset of those
saved views into discoverable, reusable catalog entries while preserving the
same source-of-truth boundary and keeping operator surfaces thin.

## Why This Is Phase 16

Once operators can preserve and reopen constrained investigations, the next
repository-owned gap is not a full collaborative product or analytics suite.
It is the lack of a shared, package-owned way to curate and discover a small
set of reusable audit presets across surfaces. A thin catalog layer closes that
gap before broader sharing, RBAC, dashboard, search, or platform concerns that
the repository still defers beyond this phase.

## Start Gate Before Phase 16 Execution

Before Phase 16 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 16 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 17 scope.
