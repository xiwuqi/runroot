# Phase 15: Cross-Run Audit Saved Views and Operator Presets

Status: implemented on branch, pending phase review

This document proposes the repository-owned Phase 15 execution contract for
Runroot. It defines the minimum implementation boundary for saved audit views
and operator presets over the existing cross-run summaries, identifier-driven
drilldowns, and linked run-scoped audit views that already exist through the
shared operator seams.

Primary source material:

- [docs/architecture/phase-0-blueprint.md](./phase-0-blueprint.md)
- [docs/architecture/replay-model.md](./replay-model.md)
- [docs/architecture/tool-execution.md](./tool-execution.md)
- [docs/architecture/web-console.md](./web-console.md)
- [docs/architecture/extension-model.md](./extension-model.md)
- [docs/architecture/adr-0004-event-model-and-replay-source-of-truth.md](./adr-0004-event-model-and-replay-source-of-truth.md)
- [docs/architecture/adr-0008-web-console-and-observability-boundaries.md](./adr-0008-web-console-and-observability-boundaries.md)
- [docs/architecture/adr-0010-persisted-tool-history-and-execution-telemetry.md](./adr-0010-persisted-tool-history-and-execution-telemetry.md)
- [docs/architecture/adr-0011-correlated-audit-projections-and-operator-views.md](./adr-0011-correlated-audit-projections-and-operator-views.md)
- [docs/architecture/adr-0012-cross-run-audit-queries-and-filters.md](./adr-0012-cross-run-audit-queries-and-filters.md)
- [docs/architecture/adr-0013-cross-run-audit-drilldowns-and-identifier-queries.md](./adr-0013-cross-run-audit-drilldowns-and-identifier-queries.md)
- [docs/architecture/adr-0014-cross-run-audit-navigation-and-linked-operator-views.md](./adr-0014-cross-run-audit-navigation-and-linked-operator-views.md)
- [docs/architecture/phase-14-handoff.md](./phase-14-handoff.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/guides/audit-projections.md](../guides/audit-projections.md)
- [docs/guides/audit-queries.md](../guides/audit-queries.md)
- [docs/guides/audit-drilldowns.md](../guides/audit-drilldowns.md)
- [docs/guides/audit-navigation.md](../guides/audit-navigation.md)
- [docs/guides/tool-telemetry.md](../guides/tool-telemetry.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 14 closed the thin navigation gap between cross-run audit summaries,
identifier-driven drilldowns, and existing run-scoped audit views. The next
repository-owned operator gap is that those constrained reads still depend on
surface-local URLs, browser state, or manual re-entry of the same filters when
an operator wants to revisit the same investigation later.

The smallest next step is to add a shared saved-view and preset contract over
the existing navigation model. This closes a narrow operator workflow gap
without jumping into a productized dashboard, broad analytics UX, open-ended
search product, or backend observability platform.

## Formal Name

- Primary name: `Cross-Run Audit Saved Views and Operator Presets`
- Short label: `Saved Audit Views`

This is the suggested freeze name for Phase 15. If this document is merged, it
becomes the repository-owned formal Phase 15 name.

## Formal Goals

1. Add a shared saved-view and operator-preset contract that records stable
   audit-navigation filters plus optional navigation references that only
   augment a constrained saved view, without snapshotting audit facts or
   redefining replay or approval source of truth.
2. Expose the minimum save, list, load, and apply paths needed for SDK, API,
   CLI, and web surfaces to reopen constrained audit investigations through the
   existing seams rather than app-owned storage reads.
3. Allow inline and queued execution paths to participate in the same
   saved-view rules without introducing a second runtime model, search engine,
   or workflow-correctness layer.
4. Provide the minimum local-development and CI guidance needed to validate the
   shared saved-view contract and thin operator-facing preset surfaces.
5. Document the observability, dashboard, analytics, search, and platform work
   that remains deferred beyond Phase 15.

## Formal Acceptance Standards

1. A shared saved-view and operator-preset contract exists in packages and
   remains a derived layer over existing summary, drilldown, and run-scoped
   audit navigation reads.
2. Operators can save, list, load, and apply constrained audit views by using
   stable filter state plus optional navigation references instead of
   surface-specific bookmarks or copied URLs.
3. Existing operator surfaces can query or present those saved-view paths
   through existing seams without introducing app-owned storage reads or a new
   orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. Saved views store stable filters and optional navigation references rather
   than full provider-specific payloads or workflow-state snapshots, and
   references alone do not make an otherwise unconstrained view valid.
6. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the saved-view path.
7. Local-development and CI guidance exists for the Phase 15 path.
8. Phase 15 naming is consistent across changed docs.
9. `pnpm lint` passes.
10. `pnpm typecheck` passes.
11. `pnpm test` passes.
12. `pnpm test:integration` passes.
13. `pnpm build` passes.
14. The phase does not introduce Phase 16 scope, a full observability backend,
    a productized dashboard, or an open-ended search and analytics product.

## Formal Non-Goals

Phase 15 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, or open-ended search products.
3. Replacing replay with a saved-view model or redefining additive audit facts
   as workflow-state source of truth.
4. Persisting every provider-specific tool payload or full audit fact snapshots
   by default.
5. Collaborative sharing, multi-user curation, RBAC, or broader SaaS product
   concerns around saved views.
6. New workflow templates or unrelated API, CLI, or web product behavior.
7. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
8. Plugin, marketplace, or ecosystem packaging work.
9. Phase 16 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/persistence`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin saved-view presentation and preset application
  through existing API seams
- `packages/config` only if minimal preset defaults need documentation or
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

1. Phases 2 through 14 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, cross-run audit query
   baseline, identifier-driven drilldown baseline, and linked audit navigation
   baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support saved views without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning saved audit views into a second source of truth for
   replay or approval semantics.
2. Making additive tool, worker, or dispatch facts look required for workflow
   correctness rather than operator-facing audit context.
3. Expanding a saved-view phase into a dashboard, analytics, search, or
   backend-platform effort.
4. Coupling the shared saved-view contract too tightly to web route structure,
   storage layout, or indexing assumptions instead of keeping it as a stable
   read-model boundary.
5. Letting preset persistence pull in premature collaboration, RBAC, or
   multi-tenant product scope.

## Must Be Deferred

The following remain out of scope for Phase 15:

1. Phase 16 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, broad analytics UX, or open-ended
   search products.
4. Persisting every provider-specific tool payload or every derived audit fact
   snapshot by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. Collaborative saved-view catalogs, RBAC-governed sharing, or broader
   operator product surfaces beyond the minimum preset path for this phase.
7. Plugin, marketplace, or broader ecosystem packaging work.
8. Broad event-model redesign beyond the additional derived saved-view
   contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-15-saved-audit-views`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the saved-view boundary
2. shared saved-view and operator-preset contract
3. persistence and thin API, CLI, SDK, and web preset wiring
4. integration coverage for inline and queued saved-view reads
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the saved-view persistence seam must land independently of the
  thin operator-facing preset surfaces.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 14

Phase 14 established shared navigation between cross-run summaries,
identifier-driven drilldowns, and existing run-scoped audit views. Phase 15
builds on that foundation by preserving constrained navigation state in a
shared saved-view contract, while preserving the same source-of-truth boundary
and keeping operator surfaces thin.

## Why This Is Phase 15

Once operators can move through summaries, drilldowns, and run-scoped audit
views, the next repository-owned gap is not a full dashboard or analytics
product. It is the lack of a shared, repository-owned way to preserve and
reopen those constrained investigations without each surface inventing its own
bookmark or URL format. A thin saved-view layer closes that operator workflow
gap before broader dashboards, metrics backends, search products, or platform
concerns that the repository still defers beyond this phase.

## Start Gate Before Phase 15 Execution

Before Phase 15 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 15 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 16 scope.
