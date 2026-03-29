# Phase 13: Cross-Run Audit Drilldowns and Identifier Queries

Status: formal handoff merged; implementation baseline pending review

This document proposes the repository-owned Phase 13 execution contract for
Runroot. It defines the minimum implementation boundary for stable,
identifier-driven drilldowns over the derived cross-run audit facts already
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
- [docs/architecture/phase-12-handoff.md](./phase-12-handoff.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/guides/audit-projections.md](../guides/audit-projections.md)
- [docs/guides/audit-queries.md](../guides/audit-queries.md)
- [docs/guides/tool-telemetry.md](../guides/tool-telemetry.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 12 closed the thin cross-run query gap by adding shared list and filter
paths over derived audit facts. The next repository-owned gap is that operators
still cannot pivot from those result sets through stable identifiers without
manually stitching together repeated run-level reads. Today, operators can list
and filter cross-run summaries, but cannot follow approval, dispatch, worker,
step, or tool identifiers through a shared drilldown contract.

The smallest next step is to add a shared, identifier-driven drilldown layer
plus thin operator-facing read paths over that contract. This closes an
operator exploration gap without jumping into a productized dashboard, broad
analytics UX, open-ended search product, or backend observability platform.

## Formal Name

- Primary name: `Cross-Run Audit Drilldowns and Identifier Queries`
- Short label: `Audit Drilldowns`

This is the suggested freeze name for Phase 13. If this document is merged, it
becomes the repository-owned formal Phase 13 name.

## Formal Goals

1. Add a shared cross-run audit drilldown and identifier-query contract that
   reads derived audit facts through stable identifiers without redefining
   replay or approval source of truth.
2. Expose the minimum operator-facing drilldown paths needed for SDK, API,
   CLI, and web surfaces to pivot from cross-run summaries into narrower audit
   reads through existing seams.
3. Allow inline and queued execution paths to participate in the same
   identifier-driven audit exploration rules without introducing a second
   runtime model or a workflow-correctness engine.
4. Provide the minimum local-development and CI guidance needed to validate the
   drilldown contract and thin operator-facing read paths.
5. Document the observability, dashboard, analytics, and platform work that
   remains deferred beyond Phase 13.

## Formal Acceptance Standards

1. A shared cross-run audit drilldown and identifier-query contract exists in
   packages and reads derived audit facts without promoting additive facts into
   replay or approval inputs.
2. An operator can retrieve cross-run audit reads constrained by stable
   identifiers such as run, approval, step, dispatch job, worker, or tool
   identifiers, and those reads remain correlated across inline and queued
   execution.
3. Existing operator surfaces can query or present the drilldown paths through
   existing seams without introducing app-owned storage reads or a new
   orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the identifier-driven drilldown path.
6. Local-development and CI guidance exists for the Phase 13 path.
7. Phase 13 naming is consistent across changed docs.
8. `pnpm lint` passes.
9. `pnpm typecheck` passes.
10. `pnpm test` passes.
11. `pnpm test:integration` passes.
12. `pnpm build` passes.
13. The phase does not introduce Phase 14 scope, a full observability backend,
    a productized dashboard, or an open-ended search and analytics product.

## Formal Non-Goals

Phase 13 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, or open-ended search products.
3. Replacing replay with an identifier-driven audit model or redefining audit
   facts as workflow-state source of truth.
4. Persisting every provider-specific tool payload by default.
5. New workflow templates or unrelated API, CLI, or web product behavior.
6. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
7. Multi-tenant auth, RBAC, billing, or broader SaaS concerns.
8. Plugin, marketplace, or ecosystem packaging work.
9. Phase 14 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/observability`
- `packages/persistence`
- `packages/events`
- `packages/config`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin audit drilldown presentation through existing API
  seams
- `apps/worker` only for thin correlation wiring if required
- docs and minimal local-development configuration

Default non-targets:

- new templates
- product-surface redesign
- unrelated runtime, queue, or persistence refactors
- broad observability backend vendor integrations

## Preconditions

1. Phases 2 through 12 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, and cross-run audit
   query baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support identifier-driven drilldowns without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning identifier-driven drilldowns into a second source of
   truth for replay or approval semantics.
2. Making additive tool, worker, or dispatch facts look required for workflow
   correctness rather than operator-facing audit context.
3. Expanding a drilldown phase into a dashboard, analytics, or backend
   platform effort.
4. Coupling the shared drilldown contract too tightly to storage layout,
   indexing assumptions, or web-route structure instead of keeping it as a
   stable read model boundary.

## Must Be Deferred

The following remain out of scope for Phase 13:

1. Phase 14 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, broad analytics UX, or open-ended
   search products.
4. Persisting every provider-specific tool payload or every hook by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. New operator product surfaces beyond the thin identifier-driven drilldowns
   needed for this phase.
7. Plugin, marketplace, or broader ecosystem packaging work.
8. Broad event-model redesign beyond the additional derived drilldown contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-13-audit-drilldowns`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the cross-run drilldown boundary
2. shared cross-run audit drilldown and identifier-query contract
3. thin API, CLI, SDK, and web drilldown-path wiring
4. integration coverage for inline and queued identifier-driven audit reads
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the shared drilldown contract must land independently of the
  thin operator read paths.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 12

Phase 12 established thin cross-run audit lists and filters through existing
operator seams. Phase 13 builds on that foundation by adding stable,
identifier-driven drilldowns over those derived facts, while preserving the
same source-of-truth boundary and keeping operator surfaces thin.

## Why This Is Phase 13

Once operators can list and filter cross-run audit summaries, the next
repository-owned gap is not a full dashboard or analytics product. It is the
lack of a shared way to pivot from those summaries through stable identifiers
without manual stitching. A thin drilldown layer closes that exploration gap
before broader dashboards, metrics backends, search products, or platform
concerns that the repository still defers beyond this phase.

## Start Gate Before Phase 13 Execution

Before Phase 13 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 13 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 14 scope.
