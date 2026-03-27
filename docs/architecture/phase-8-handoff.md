# Phase 8: Postgres-First Persistence and SQLite Development Fallback

Status: suggested freeze version, scope frozen, implementation not started

This document freezes a suggested Phase 8 execution contract for Runroot. The
name and scope below are derived from repository-owned sources that already
exist:

- `docs/architecture/adr-0003-postgres-first-with-sqlite-dev-fallback.md`
- `docs/architecture/phase-0-blueprint.md`
- `docs/architecture/phase-7-handoff.md`
- `docs/roadmap.md`
- `README.md`

Phase 8 was not previously named as a formal stage in the repository. This
document provides the most conservative freeze that aligns the next phase with
existing architectural commitments rather than inventing a new product track.

## Why Now

Phases 2 through 6 established the runtime, tool layer, approvals, replay,
operator surfaces, web console, and observability seams. Phase 7 then made the
repository contributor-ready and release-aware.

The main unresolved architecture gap is persistence. Runroot's accepted
architecture still says:

- Postgres is the primary durable backing store
- SQLite is the local-development fallback
- the JSON-file adapter is only a local operator convenience, not a production
  database strategy

That gap now matters more than new feature breadth. Additional workflow or UI
expansion before a real database baseline would force later phases to build on
local-only storage assumptions that the repository has already documented as
temporary.

## Formal Name

Primary name:

- `Postgres-First Persistence and SQLite Development Fallback`

Short label:

- `Persistence Baseline`

Rules:

- Use the primary name in formal phase definitions, ADR references, and
  execution prompts.
- The short label may be used in roadmap summaries where brevity helps, but it
  is an alias, not a separate phase.
- This name is a suggested freeze version derived from existing repository
  commitments. Once merged, it becomes the repository-owned Phase 8 definition
  unless a later docs-only scope change supersedes it.

## Formal Goals

Phase 8 focuses on closing the persistence gap between the current repository
state and the accepted architecture.

Goals:

1. land a Postgres-backed persistence adapter for the existing runtime,
   checkpoint, event, and approval contracts without changing the public
   runtime, API, CLI, or web semantics
2. add a SQLite adapter as the local-development fallback where practical, and
   document any deliberately unsupported parity gaps rather than hiding them
3. introduce the minimum schema, migration, and local-infra path needed to run
   the database-backed repository state locally and in CI
4. move current operator-facing surfaces onto configurable database-backed
   persistence through existing seams instead of treating the JSON-file adapter
   as the implied long-term path
5. preserve replay, approval, and audit semantics while documenting which
   persistence concerns remain deferred after the database baseline lands

## Formal Acceptance Standards

Phase 8 is complete only when all of the following are true:

1. the repository contains a Postgres-backed adapter for the current runtime
   persistence contracts
2. the repository contains a SQLite local-development fallback adapter for the
   same core contracts where practical, and any scoped deviations are called
   out explicitly in docs
3. schema and migration assets exist and are documented well enough for local
   setup and CI use
4. local infrastructure and environment guidance are clear enough that a
   contributor can run the database-backed baseline without reverse-engineering
   hidden setup steps
5. current API, CLI, and web operator flows can use the configured persistence
   seam without introducing new business logic in those surfaces
6. replay and approval semantics still derive from persisted runtime and
   approval events rather than a new database-specific projection model
7. adapter-level and integration tests cover the Postgres path and the SQLite
   fallback path for the core durable execution flows that already exist
8. persistence docs, roadmap references, and architecture docs use the frozen
   Phase 8 naming consistently
9. lint passes
10. typecheck passes
11. tests pass
12. integration tests pass
13. build passes
14. the phase does not introduce new workflow features, new product surfaces,
    or Phase 9 scope

## Formal Non-Goals

Phase 8 does not include:

1. new runtime, tool, approval, replay, API, CLI, or web features unrelated to
   persistence
2. multi-tenant storage, auth, RBAC, billing, or SaaS concerns
3. distributed queue infrastructure, worker sharding, or throughput-oriented
   orchestration redesign
4. full deployment platform work such as HA Postgres, backups automation,
   multi-region design, or cloud-specific database operations
5. observability backend expansion, metrics platforms, or dashboard product
   work
6. release-system expansion beyond the minimum assets already landed in Phase 7
7. automatic promotion of tool lifecycle hooks into persisted replay history
8. Phase 9 or later product expansion

## Recommended Monorepo Impact Range

Expected high-signal areas:

- `packages/persistence`
- `packages/test-utils`
- `packages/config`
- `packages/core-runtime`
- `packages/events`
- `packages/approvals`
- `packages/replay`
- `apps/api`, `packages/cli`, `packages/sdk`, and `apps/web` only for thin
  persistence configuration or wiring changes through existing seams
- `compose.yaml`, `.env.example`, workspace scripts, and migration config only
  where required to support the database baseline
- `docs/architecture/*`
- `docs/guides/*`
- `README.md`

Default non-targets:

- new workflow templates
- product-surface redesign in `apps/*`
- unrelated package refactors

These should only change if the persistence baseline genuinely cannot be landed
without them, and that reason must be documented during execution.

## Preconditions

Phase 8 execution assumes:

1. Phases 2 through 7 are merged into `main`
2. there are no remaining stacked PR dependencies
3. the current persistence contracts are stable enough to receive concrete
   adapters without reopening the core runtime model
4. baseline quality commands can run before Phase 8 starts
5. release-readiness and contributor docs from Phase 7 are already in place, so
   the database baseline can be documented without another process-only phase

Current repository status at freeze time:

- these preconditions are satisfied

## Primary Architecture Risks

The main risks in Phase 8 are boundary and scope risks.

1. leaking database-specific logic into runtime orchestration or app surfaces
   instead of keeping it behind persistence contracts
2. overfitting the contracts to SQLite limitations in ways that weaken the
   Postgres-first architecture
3. letting persistence work silently expand into a full deployment platform or
   distributed systems phase
4. changing replay or approval source-of-truth semantics while introducing the
   new adapters

## Must Be Deferred

The following remain out of scope after Phase 8:

1. Phase 9 or later feature expansion
2. hosted or HA database operations, backup strategy automation, and large
   deployment-matrix work
3. distributed queues, worker orchestration, or multi-node concurrency models
4. full observability backend integration
5. new operator product surfaces
6. plugin, marketplace, or ecosystem packaging work
7. promoting all tool hooks into persisted replay history without a separate
   model decision

## Recommended Branch Name Slug

When implementation begins, use:

- `wuxi/phase-8-postgres-first-persistence`

This scope-freeze branch is intentionally separate and should not be reused for
the implementation phase.

## Recommended Commit Slicing

If Phase 8 implementation proceeds, prefer reviewable slices:

1. persistence docs and boundary alignment
2. Postgres schema, migrations, and primary adapter
3. SQLite local-development fallback adapter
4. thin wiring updates for API, CLI, SDK, and web to use configured
   persistence seams
5. integration tests and final docs polish

## Recommended PR Strategy

Phase 8 should use direct-to-main PRs from the latest `main`.

Preferred strategy:

- one primary PR if the database baseline remains narrowly scoped
- split into two PRs only if infrastructure and migration assets need separate
  review from adapter logic

Do not use stacked PRs for Phase 8 unless a new blocker appears and is
documented first.

## Relationship To Phase 7

Phase 7 made the repository contributor-ready and release-aware. Phase 8 should
not expand those collaboration assets. Instead, it should make the underlying
runtime storage story match the architecture that contributors are now being
asked to trust and extend.

## Why This Is Phase 8 And Not A Later Phase

These tasks belong in Phase 8 because they close an already documented
architecture gap rather than opening a new product surface. The repository has
reached the point where local-only persistence is more limiting than missing UI
or workflow breadth. A database baseline belongs before any later phase that
would otherwise deepen reliance on temporary adapters.

## Start Gate For The Execution Phase

Before the Phase 8 execution branch is created, re-check:

1. `main` is synced to `origin/main`
2. no open stacked PRs remain
3. the working tree is clean
4. the frozen Phase 8 naming is consistent in `AGENTS.md`,
   `docs/roadmap.md`, and this handoff document
5. the execution plan still fits inside the non-goals above
