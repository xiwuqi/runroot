# Phase 14: Cross-Run Audit Navigation and Linked Operator Views

Status: repository-owned scope freeze; implementation not started

This document proposes the repository-owned Phase 14 execution contract for
Runroot. It defines the minimum implementation boundary for thin,
operator-facing navigation between the derived cross-run audit summaries,
identifier-driven drilldowns, and existing run-scoped audit views already
available through replay, dispatch, worker, and tool-history seams.

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
- [docs/architecture/phase-13-handoff.md](./phase-13-handoff.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/guides/audit-projections.md](../guides/audit-projections.md)
- [docs/guides/audit-queries.md](../guides/audit-queries.md)
- [docs/guides/audit-drilldowns.md](../guides/audit-drilldowns.md)
- [docs/guides/tool-telemetry.md](../guides/tool-telemetry.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 13 closed the thin identifier-driven drilldown gap. Operators can now
filter cross-run summaries and drill into constrained sets of derived audit
facts by stable identifiers. The next repository-owned gap is that those
operator reads still stop at isolated result sets. Moving from a cross-run
summary into a drilldown and then back into an existing run-scoped audit view
still depends on surface-specific glue instead of a shared navigation
contract.

The smallest next step is to add a shared audit-navigation layer plus thin
linked operator views over that contract. This closes a narrow operator
navigation gap without jumping into a productized dashboard, broad analytics
UX, open-ended search product, or backend observability platform.

## Formal Name

- Primary name: `Cross-Run Audit Navigation and Linked Operator Views`
- Short label: `Audit Navigation`

This is the suggested freeze name for Phase 14. If this document is merged, it
becomes the repository-owned formal Phase 14 name.

## Formal Goals

1. Add a shared cross-run audit navigation contract that links cross-run audit
   summaries, identifier-driven drilldowns, and existing run-scoped audit
   views through stable references without redefining replay or approval source
   of truth.
2. Expose the minimum linked operator-view paths needed for SDK, API, CLI, and
   web surfaces to move through those reads by using existing seams rather than
   app-owned storage reads.
3. Allow inline and queued execution paths to participate in the same
   navigation rules without introducing a second runtime model, search engine,
   or workflow-correctness layer.
4. Provide the minimum local-development and CI guidance needed to validate
   the shared navigation contract and thin operator-facing linked views.
5. Document the observability, dashboard, analytics, and platform work that
   remains deferred beyond Phase 14.

## Formal Acceptance Standards

1. A shared cross-run audit navigation contract exists in packages and remains
   a derived read model over existing audit summaries, drilldowns, and
   run-scoped audit views.
2. Operators can move from cross-run summaries into identifier-driven
   drilldowns and from those drilldowns into existing run-scoped audit views by
   using stable navigation references instead of surface-specific stitching.
3. Existing operator surfaces can query or present those linked operator-view
   paths through existing seams without introducing app-owned storage reads or
   a new orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the navigation path.
6. Local-development and CI guidance exists for the Phase 14 path.
7. Phase 14 naming is consistent across changed docs.
8. `pnpm lint` passes.
9. `pnpm typecheck` passes.
10. `pnpm test` passes.
11. `pnpm test:integration` passes.
12. `pnpm build` passes.
13. The phase does not introduce Phase 15 scope, a full observability backend,
    a productized dashboard, or an open-ended search and analytics product.

## Formal Non-Goals

Phase 14 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, or open-ended search products.
3. Replacing replay with an audit-navigation model or redefining additive
   audit facts as workflow-state source of truth.
4. Persisting every provider-specific tool payload by default.
5. New workflow templates or unrelated API, CLI, or web product behavior.
6. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
7. Multi-tenant auth, RBAC, billing, or broader SaaS concerns.
8. Plugin, marketplace, or ecosystem packaging work.
9. Phase 15 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin audit-navigation presentation through existing API
  seams
- `packages/config` only if minimal navigation defaults need documentation or
  exposure
- docs and minimal local-development configuration

Optional thin-touch areas only if implementation requires them:

- `packages/observability`
- `packages/persistence`
- `packages/events`
- `apps/worker`

Default non-targets:

- new templates
- product-surface redesign
- unrelated runtime, queue, or persistence refactors
- broad observability backend vendor integrations

## Preconditions

1. Phases 2 through 13 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, cross-run audit query
   baseline, and identifier-driven drilldown baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support linked navigation without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning audit navigation into a second source of truth for
   replay or approval semantics.
2. Making additive tool, worker, or dispatch facts look required for workflow
   correctness rather than operator-facing audit context.
3. Expanding a navigation phase into a dashboard, analytics, search, or
   backend-platform effort.
4. Coupling the shared navigation contract too tightly to storage layout,
   indexing assumptions, or specific web-route structure instead of keeping it
   as a stable read-model boundary.

## Must Be Deferred

The following remain out of scope for Phase 14:

1. Phase 15 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, broad analytics UX, or open-ended
   search products.
4. Persisting every provider-specific tool payload or every hook by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. New operator product surfaces beyond the thin linked views needed for this
   phase.
7. Plugin, marketplace, or broader ecosystem packaging work.
8. Broad event-model redesign beyond the additional derived navigation
   contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-14-audit-navigation`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the audit-navigation boundary
2. shared cross-run audit navigation contract
3. thin API, CLI, SDK, and web linked-view wiring
4. integration coverage for inline and queued navigation reads
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the shared navigation contract must land independently of the
  thin linked operator views.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 13

Phase 13 established thin identifier-driven drilldowns over derived audit
facts. Phase 14 builds on that foundation by linking cross-run summaries,
identifier-constrained drilldowns, and existing run-scoped audit views through
one shared navigation contract, while preserving the same source-of-truth
boundary and keeping operator surfaces thin.

## Why This Is Phase 14

Once operators can list, filter, and drill into constrained audit facts, the
next repository-owned gap is not a full dashboard or analytics product. It is
the lack of a shared way to move between those constrained reads without
surface-specific stitching. A thin navigation layer closes that operator gap
before broader dashboards, metrics backends, search products, or platform
concerns that the repository still defers beyond this phase.

## Start Gate Before Phase 14 Execution

Before Phase 14 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 14 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 15 scope.
