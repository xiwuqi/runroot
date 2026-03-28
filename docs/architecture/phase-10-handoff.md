# Phase 10: Persisted Tool History and Execution Telemetry

Status: suggested freeze, pending review and merge

This document is the proposed formal Phase 10 execution contract for Runroot.
It is a conservative freeze derived from repository-owned materials that defer
persisted tool-hook history and richer execution telemetry until after
queue-backed execution has landed. This is not a claim that Phase 10 was
already defined elsewhere; it is the suggested repository-owned contract to
adopt next.

Primary source material:

- [docs/architecture/phase-0-blueprint.md](./phase-0-blueprint.md)
- [docs/architecture/tool-execution.md](./tool-execution.md)
- [docs/architecture/runtime-lifecycle.md](./runtime-lifecycle.md)
- [docs/architecture/adr-0004-event-model-and-replay-source-of-truth.md](./adr-0004-event-model-and-replay-source-of-truth.md)
- [docs/architecture/adr-0008-web-console-and-observability-boundaries.md](./adr-0008-web-console-and-observability-boundaries.md)
- [docs/architecture/phase-9-handoff.md](./phase-9-handoff.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 9 moved execution out of the initiating request process while preserving
runtime, approval, and replay semantics. The main operational gap left after
that work is that tool execution facts still live in in-memory hooks and
observability remains a minimal seam without durable cross-process correlation.

The smallest next step is to persist a scoped subset of tool history and to
correlate execution telemetry across API, worker, and runtime paths without
turning observability into a new source of truth or a full backend platform.

## Formal Name

- Primary name: `Persisted Tool History and Execution Telemetry`
- Short label: `Tool Telemetry`

This is the suggested freeze name for Phase 10. If this document is merged, it
becomes the repository-owned formal Phase 10 name.

## Formal Goals

1. Promote a scoped subset of tool lifecycle facts into a persisted audit
   history through shared package seams, without changing the existing runtime
   or approval source of truth.
2. Correlate run, step, dispatch job, worker, and tool execution identifiers
   through the existing logging and tracing adapters.
3. Expose the minimum query and presentation path needed for operator surfaces
   to read persisted tool history through existing seams.
4. Provide the minimum local-development and CI guidance needed to validate the
   persisted tool-history and telemetry path.
5. Document the observability and audit work that still remains deferred beyond
   Phase 10.

## Formal Acceptance Standards

1. A shared persisted tool-history contract exists in packages and is fed from
   the existing tool invocation hooks rather than ad hoc app logic.
2. Scoped tool lifecycle outcomes such as started, blocked, succeeded, and
   failed can be durably associated with run and step identifiers.
3. Existing observability adapters can correlate run, step, dispatch job,
   worker, and tool identifiers across both inline and queued execution paths.
4. Existing operator surfaces can query or present persisted tool history
   through existing seams without introducing a new orchestration layer.
5. Replay and approval semantics still derive from persisted runtime and
   approval events; persisted tool history remains additive audit data rather
   than a replacement source of truth.
6. At least one inline execution path and one queued execution path have
   integration coverage for persisted tool history and telemetry correlation.
7. Local-development and CI guidance exists for the Phase 10 path.
8. Phase 10 naming is consistent across changed docs.
9. `pnpm lint` passes.
10. `pnpm typecheck` passes.
11. `pnpm test` passes.
12. `pnpm test:integration` passes.
13. `pnpm build` passes.
14. The phase does not introduce Phase 11 scope, new operator product
    surfaces, or a full observability platform.

## Formal Non-Goals

Phase 10 does not include:

1. Full observability backend integration, log shipping, metrics platform, or
   alerting stack.
2. Productized dashboards, broad analytics UX, or new operator product
   surfaces.
3. Persisting every tool-provider detail or freezing all hook payloads as a
   public compatibility contract.
4. New workflow templates or unrelated API, CLI, or web product behavior.
5. Multi-tenant auth, RBAC, billing, or broader SaaS concerns.
6. Worker sharding, autoscaling, advanced scheduling, or hosted queue
   operations.
7. Plugin, marketplace, or ecosystem packaging work.
8. Phase 11 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/tools`
- `packages/observability`
- `packages/persistence`
- `packages/events`
- `packages/replay`
- `packages/config`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin presentation of persisted tool history through
  existing API seams
- `apps/worker` only for thin telemetry correlation wiring if required
- docs and minimal local-development configuration

Default non-targets:

- new templates
- product-surface redesign
- unrelated queue or persistence refactors
- broad observability backend vendor integrations

## Preconditions

1. Phases 2 through 9 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline and queued execution path are both
   in place and stable.
4. Baseline quality commands are runnable.
5. Tool hooks, replay, and observability adapter seams are stable enough to
   support persisted audit data without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally redefining replay or approval source of truth while adding
   persisted tool history.
2. Letting provider-specific tool payloads leak into shared runtime or app
   contracts.
3. Expanding a telemetry phase into a full observability platform or dashboard
   product.
4. Making cross-process execution telemetry hard to test, reason about, or
   audit.

## Must Be Deferred

The following remain out of scope for Phase 10:

1. Phase 11 or later product and platform expansion.
2. Full metrics backends, log shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards or analytics suites.
4. Persisting every tool hook or provider-specific payload by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. New operator product surfaces.
7. Plugin, marketplace, or broader ecosystem packaging work.
8. Broader event-model redesign beyond the scoped tool-history addition.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-10-persisted-tool-history`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for persisted tool history and execution telemetry
2. shared persisted tool-history contract and storage path
3. logging and tracing correlation wiring across inline and queued execution
4. thin API, CLI, SDK, worker, and web read-path wiring
5. integration coverage and docs polish

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the persisted tool-history contract must land independently of
  telemetry wiring.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 9

Phase 9 established queue-backed execution and the minimum worker path. Phase
10 builds on that topology by making tool activity durable and correlatable
across API, worker, and runtime paths while keeping replay and approval facts
anchored to the existing persisted event model.

## Why This Is Phase 10

After queue-backed execution lands, the most important remaining gap in the
repository-owned architecture is that tool activity is still only visible
through in-memory hooks and thin local telemetry seams. Persisted tool history
and execution telemetry are the smallest next step that improve auditability
and operational reasoning without expanding into the broader product or hosted
platform work explicitly deferred beyond this phase.

## Start Gate Before Phase 10 Execution

Before Phase 10 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 10 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 11 scope.
