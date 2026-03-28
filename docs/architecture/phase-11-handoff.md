# Phase 11: Correlated Audit Projections and Operator Views

Status: implementation completed on branch, pending review and merge

This document is the proposed formal Phase 11 execution contract for Runroot.
It is a conservative freeze derived from repository-owned materials that now
have persisted tool history and queue-backed execution, but still only expose
minimal, separate operator read paths. This is not a claim that Phase 11 was
already defined elsewhere; it is the suggested repository-owned contract to
adopt next.

Primary source material:

- [docs/architecture/phase-0-blueprint.md](./phase-0-blueprint.md)
- [docs/architecture/replay-model.md](./replay-model.md)
- [docs/architecture/tool-execution.md](./tool-execution.md)
- [docs/architecture/web-console.md](./web-console.md)
- [docs/architecture/adr-0004-event-model-and-replay-source-of-truth.md](./adr-0004-event-model-and-replay-source-of-truth.md)
- [docs/architecture/adr-0006-approval-events-and-replay-timeline.md](./adr-0006-approval-events-and-replay-timeline.md)
- [docs/architecture/adr-0008-web-console-and-observability-boundaries.md](./adr-0008-web-console-and-observability-boundaries.md)
- [docs/architecture/adr-0010-persisted-tool-history-and-execution-telemetry.md](./adr-0010-persisted-tool-history-and-execution-telemetry.md)
- [docs/architecture/phase-10-handoff.md](./phase-10-handoff.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/guides/tool-telemetry.md](../guides/tool-telemetry.md)
- [docs/guides/queued-execution.md](../guides/queued-execution.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 10 made tool history durable and correlated it across inline and queued
execution, but operator surfaces still expose replay timeline facts and tool
history through separate minimal paths. The repository also already documents
that replay may need more than one derived projection style and that
tool-level observability in the UI was intentionally deferred until persisted
tool facts were proven.

The smallest next step is to add a correlated audit projection and thin
operator-facing views over that projection. This keeps replay and approval
source-of-truth rules intact while making the durable audit story more usable
for operators and contributors.

## Formal Name

- Primary name: `Correlated Audit Projections and Operator Views`
- Short label: `Audit Projections`

This is the suggested freeze name for Phase 11. If this document is merged, it
becomes the repository-owned formal Phase 11 name.

## Formal Goals

1. Add a shared correlated audit projection or read contract that combines
   persisted runtime and approval timeline facts with additive dispatch,
   worker, and tool-history records without redefining replay source of truth.
2. Expose the minimum run-scoped operator read paths needed for API, CLI, SDK,
   and web surfaces to inspect correlated audit facts through existing seams.
3. Make inline and queued execution paths observable through the same durable
   identifiers and projection rules.
4. Provide the minimum local-development and CI guidance needed to validate
   correlated audit projections and thin operator views.
5. Document the observability, analytics, and platform work that remains
   deferred beyond Phase 11.

## Formal Acceptance Standards

1. A shared correlated audit projection or read contract exists in packages and
   reads persisted runtime and approval events together with additive
   tool-history and dispatch facts without promoting those additive facts into
   replay input.
2. A run-scoped audit view can correlate run, approval, step, dispatch job,
   worker, and tool facts through stable identifiers for both inline and queued
   execution.
3. Existing operator surfaces can query or present the correlated audit view
   through existing seams without introducing a new orchestration layer or app-
   owned projection logic.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. At least one inline execution path and one queued execution path have
   integration coverage for the correlated audit projection.
6. Local-development and CI guidance exists for the Phase 11 path.
7. Phase 11 naming is consistent across changed docs.
8. `pnpm lint` passes.
9. `pnpm typecheck` passes.
10. `pnpm test` passes.
11. `pnpm test:integration` passes.
12. `pnpm build` passes.
13. The phase does not introduce Phase 12 scope, a full observability backend,
    or productized analytics surfaces.

## Formal Non-Goals

Phase 11 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, or cross-run exploration
   surfaces that expand the product boundary.
3. Replacing replay with a joined audit model or redefining tool history as
   workflow-state source of truth.
4. Persisting every provider-specific tool payload by default.
5. New workflow templates or unrelated API, CLI, or web product behavior.
6. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
7. Multi-tenant auth, RBAC, billing, or broader SaaS concerns.
8. Plugin, marketplace, or ecosystem packaging work.
9. Phase 12 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/tools`
- `packages/observability`
- `packages/persistence`
- `packages/events`
- `packages/config`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin presentation of the correlated audit view through
  existing API seams
- `apps/worker` only for thin correlation wiring if required
- docs and minimal local-development configuration

Default non-targets:

- new templates
- product-surface redesign
- unrelated runtime, queue, or persistence refactors
- broad observability backend vendor integrations

## Preconditions

1. Phases 2 through 10 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, and
   persisted tool-history path are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, tool-history, observability, and operator seams are stable enough to
   support a second derived audit projection without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning the correlated audit projection into a second source of
   truth for replay or approval semantics.
2. Making additive tool, worker, or dispatch facts look required for workflow
   correctness rather than operator-facing audit context.
3. Expanding an audit-view phase into a dashboard, analytics, or backend
   platform effort.
4. Making cross-path correlation difficult to test, reason about, or audit.

## Must Be Deferred

The following remain out of scope for Phase 11:

1. Phase 12 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, cross-run analytics, or broad search
   products.
4. Persisting every provider-specific tool payload or every hook by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. New operator product surfaces beyond the thin audit views needed for this
   phase.
7. Plugin, marketplace, or broader ecosystem packaging work.
8. Broad event-model redesign beyond the additional derived audit projection.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-11-correlated-audit-projections`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the correlated audit projection boundary
2. shared correlated audit projection or read contract
3. thin API, CLI, SDK, and web read-path wiring
4. integration coverage for inline and queued audit projections
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the shared audit projection contract must land independently of
  operator read-path wiring.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 10

Phase 10 made tool history durable and minimally readable while preserving
replay and approval boundaries. Phase 11 builds on that foundation by adding a
second, operator-facing derived projection that correlates persisted runtime
facts with additive tool, worker, and dispatch facts without changing the
source-of-truth model established in earlier phases.

## Why This Is Phase 11

After tool history becomes durable, the next repository-owned gap is not a full
observability backend. It is the lack of a coherent correlated audit view that
operators can query through existing seams. A thin audit projection closes that
gap before any broader dashboard, metrics, or hosted-platform work that the
repository still defers beyond this phase.

## Start Gate Before Phase 11 Execution

Before Phase 11 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 11 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 12 scope.
