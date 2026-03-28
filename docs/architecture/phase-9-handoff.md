# Phase 9: Queue-Backed Execution and Worker Coordination

Status: suggested freeze version, scope frozen, implementation not started

This document is the formal Phase 9 execution contract for Runroot. It is a
conservative freeze derived from repository-owned materials that explicitly
defer queue-backed execution and worker coordination to a later phase. It is
not a record of work already completed.

Primary source material:

- [docs/architecture/phase-0-blueprint.md](./phase-0-blueprint.md)
- [docs/architecture/runtime-lifecycle.md](./runtime-lifecycle.md)
- [docs/architecture/adr-0004-event-model-and-replay-source-of-truth.md](./adr-0004-event-model-and-replay-source-of-truth.md)
- [docs/architecture/phase-8-handoff.md](./phase-8-handoff.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 8 established a durable database-backed persistence baseline. The most
important deferred execution gap after that work is that run execution is still
effectively process-local. The next architectural step is to introduce a
queue-backed execution path and minimum worker coordination without changing the
runtime, approval, replay, or operator semantics that earlier phases already
stabilized.

## Formal Name

- Primary name: `Queue-Backed Execution and Worker Coordination`
- Short label: `Queued Execution`

This name is the suggested freeze version derived from existing repository
materials. Once merged into `main`, it becomes the repository-owned formal
Phase 9 name.

## Formal Goals

1. Introduce a queue-backed execution or dispatch contract behind the existing
   runtime and operator seams without changing public semantics.
2. Add a minimum worker coordination path that can claim queued work and drive
   existing runtime execution outside the initiating request process.
3. Provide the minimum local infrastructure, configuration, and operational
   guidance needed to run the queue-backed path in development and CI.
4. Keep API, CLI, SDK, and web surfaces thin by routing queue-backed execution
   through existing seams instead of adding app-owned orchestration logic.
5. Preserve replay, approval, and audit semantics while documenting the
   distributed-execution work that remains deferred beyond Phase 9.

## Formal Acceptance Standards

1. A queue-backed execution or dispatch contract exists in shared packages and
   is wired through the existing runtime persistence and operator seams.
2. A minimum worker coordination path can claim queued work and drive run
   execution without requiring the initiating process to stay alive.
3. Local configuration, local infrastructure, and startup documentation exist
   for the queue-backed execution path.
4. Existing operator surfaces can submit and observe queued runs through the
   existing seams without introducing new product behavior.
5. Replay and approval semantics still derive from persisted runtime and
   approval events.
6. At least one queue-backed execution path and one approval-aware resume path
   have integration coverage.
7. Phase 9 naming is consistent across changed docs.
8. `pnpm lint` passes.
9. `pnpm typecheck` passes.
10. `pnpm test` passes.
11. `pnpm test:integration` passes.
12. `pnpm build` passes.
13. The phase does not introduce Phase 10 scope, new operator product
    surfaces, or deployment-platform expansion.

## Formal Non-Goals

Phase 9 does not include:

1. New workflow templates or unrelated API, CLI, or web features.
2. Multi-tenant auth, RBAC, billing, or broader SaaS concerns.
3. Worker sharding, autoscaling, advanced multi-node scheduling, or full job
   orchestration.
4. Hosted queue operations, HA queue deployments, or a broad cloud deployment
   matrix.
5. Full observability backend integration or productized dashboards.
6. Plugin, marketplace, or ecosystem packaging work.
7. Promoting all tool hooks into persisted replay history.
8. Phase 10 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/core-runtime`
- `packages/persistence`
- `packages/events`
- `packages/config`
- `packages/test-utils`
- a new shared queue or dispatch package only if a real boundary requires it
- `apps/api`
- `packages/cli`
- `packages/sdk`
- `apps/web` only for thin wiring that reads queue-backed run state through the
  existing API seam
- a minimal worker surface such as `apps/worker` only if required to keep
  process boundaries explicit
- `compose.yaml`
- `.env.example`
- workspace scripts and docs related to queue-backed execution

Default non-targets:

- new templates
- product-surface redesigns
- unrelated package refactors
- vendor-bound queue abstractions without a documented boundary need

## Preconditions

1. Phases 2 through 8 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline is in place and stable.
4. Baseline quality commands are runnable.
5. Approval, replay, and operator seams are stable enough to support queued
   execution without semantic rework.

At freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Queue vendor details leaking into runtime or app surfaces.
2. Changing run, approval, or replay semantics while moving execution out of
   process.
3. Expanding a queue-backed execution phase into a full distributed-systems or
   deployment-platform effort.
4. Worker coordination becoming hard to reason about, test, or audit.

## Must Be Deferred

The following remain out of scope for Phase 9:

1. Phase 10 or later product and platform expansion.
2. Worker sharding, autoscaling, and advanced multi-node scheduling.
3. Hosted queue operations, HA queue deployments, and broad deployment-matrix
   work.
4. Full observability backend integration.
5. New operator product surfaces.
6. Plugin, marketplace, or broader ecosystem packaging work.
7. Broad persistence redesign outside the queue-backed execution use case.
8. Promotion of all tool hooks into persisted replay history.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-9-queue-backed-execution`

## Recommended Commit Slicing

Recommended split:

1. docs and boundary alignment for queue-backed execution
2. shared dispatch contract and baseline adapter
3. minimal worker coordination surface
4. thin API, CLI, SDK, and web wiring through existing seams
5. integration coverage and docs polish

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if a new shared queue package or worker surface needs isolated
  review.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 8

Phase 8 established the persistence baseline and durable database-backed source
of truth. Phase 9 builds on that by separating request handling from run
execution through a queue-backed dispatch path while preserving the persisted
event model and operator-facing semantics.

## Why This Is Phase 9

Queue-backed execution is the smallest next step that closes a deferred gap
already documented in the blueprint, runtime lifecycle notes, and Phase 8
handoff. It belongs before later platform concerns because it changes execution
topology while still depending on the contracts and persistence work already
landed.

## Start Gate Before Phase 9 Execution

Before Phase 9 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 9 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 10 scope.
