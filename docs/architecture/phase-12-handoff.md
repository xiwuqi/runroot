# Phase 12: Cross-Run Audit Queries and Filters

Status: implemented on branch, pending phase review

This document is the repository-owned formal Phase 12 execution contract for
Runroot. It defines the minimum implementation boundary for shared, cross-run
audit query paths over the derived audit facts that already exist in replay,
dispatch, worker, and tool-history seams.

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
- [docs/architecture/phase-11-handoff.md](./phase-11-handoff.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/guides/tool-telemetry.md](../guides/tool-telemetry.md)
- [docs/guides/audit-projections.md](../guides/audit-projections.md)
- [docs/guides/queued-execution.md](../guides/queued-execution.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 11 closed the single-run audit gap by adding a correlated audit view for
one run at a time. The next repository-owned gap is that operators still
cannot query or filter those correlated facts across runs through a shared
package seam. Today, a user can inspect one run in depth, but cannot answer
cross-run operational questions without stitching together separate run reads.

The smallest next step is to add a shared cross-run audit query or filter
contract plus thin operator-facing surfaces over that contract. This keeps
replay and approval source-of-truth rules intact while avoiding a jump into a
full observability backend, productized dashboard, or broad analytics product.

## Formal Name

- Primary name: `Cross-Run Audit Queries and Filters`
- Short label: `Audit Queries`

This is the suggested freeze name for Phase 12. If this document is merged, it
becomes the repository-owned formal Phase 12 name.

## Formal Goals

1. Add a shared cross-run audit query or filter contract that reads correlated
   audit facts through stable identifiers without redefining replay or approval
   source of truth.
2. Expose the minimum operator-facing list and filter paths needed for SDK,
   API, CLI, and web surfaces to query audit facts across multiple runs
   through existing seams.
3. Make inline and queued execution paths queryable through the same cross-run
   audit correlation rules without introducing a second runtime model.
4. Provide the minimum local-development and CI guidance needed to validate
   cross-run audit queries and thin operator-facing views.
5. Document the observability, analytics, and platform work that remains
   deferred beyond Phase 12.

## Formal Acceptance Standards

1. A shared cross-run audit query or filter contract exists in packages and
   reads derived audit facts without promoting additive facts into replay or
   approval inputs.
2. A cross-run audit query can return run-scoped results or summaries that
   correlate run, approval, step, dispatch job, worker, and tool facts through
   stable identifiers for both inline and queued execution.
3. Existing operator surfaces can query or present cross-run audit results
   through existing seams without introducing app-owned query logic or a new
   orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the cross-run audit query path.
6. Local-development and CI guidance exists for the Phase 12 path.
7. Phase 12 naming is consistent across changed docs.
8. `pnpm lint` passes.
9. `pnpm typecheck` passes.
10. `pnpm test` passes.
11. `pnpm test:integration` passes.
12. `pnpm build` passes.
13. The phase does not introduce Phase 13 scope, a full observability backend,
    or productized analytics surfaces.

## Formal Non-Goals

Phase 12 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, or open-ended search products.
3. Replacing replay with a cross-run audit model or redefining audit facts as
   workflow-state source of truth.
4. Persisting every provider-specific tool payload by default.
5. New workflow templates or unrelated API, CLI, or web product behavior.
6. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
7. Multi-tenant auth, RBAC, billing, or broader SaaS concerns.
8. Plugin, marketplace, or ecosystem packaging work.
9. Phase 13 or later expansion.

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
- `apps/web` only for thin cross-run audit presentation through existing API
  seams
- `apps/worker` only for thin correlation wiring if required
- docs and minimal local-development configuration

Default non-targets:

- new templates
- product-surface redesign
- unrelated runtime, queue, or persistence refactors
- broad observability backend vendor integrations

## Preconditions

1. Phases 2 through 11 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, and run-scoped correlated audit view are in place and
   stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support a cross-run derived query path without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning cross-run audit queries into a second source of truth
   for replay or approval semantics.
2. Making additive tool, worker, or dispatch facts look required for workflow
   correctness rather than operator-facing audit context.
3. Expanding a query-and-filter phase into a dashboard, analytics, or backend
   platform effort.
4. Coupling the shared query contract too tightly to storage layout or indexing
   assumptions instead of keeping it as a stable read model boundary.

## Must Be Deferred

The following remain out of scope for Phase 12:

1. Phase 13 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, broad analytics UX, or open-ended
   search products.
4. Persisting every provider-specific tool payload or every hook by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. New operator product surfaces beyond the thin query and filter paths needed
   for this phase.
7. Plugin, marketplace, or broader ecosystem packaging work.
8. Broad event-model redesign beyond the additional derived cross-run query
   contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-12-cross-run-audit-queries`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the cross-run audit query boundary
2. shared cross-run audit query or filter contract
3. thin API, CLI, SDK, and web query-path wiring
4. integration coverage for inline and queued cross-run audit queries
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the shared cross-run query contract must land independently of
  operator list and filter wiring.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 11

Phase 11 established a run-scoped correlated audit view through existing
operator seams. Phase 12 builds on that foundation by adding a cross-run query
or filter contract over those derived facts, while preserving the same
source-of-truth boundary and keeping operator surfaces thin.

## Why This Is Phase 12

Once one run can be audited coherently, the next repository-owned gap is not a
full observability backend. It is the lack of a shared way to query those
audit facts across runs through existing seams. A thin cross-run query layer
closes that gap before broader dashboards, analytics, search products, or
platform concerns that the repository still defers beyond this phase.

## Start Gate Before Phase 12 Execution

Before Phase 12 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 12 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 13 scope.
