# ADR-0007: Thin Operator Surfaces And Template Assembly

- Status: accepted
- Date: 2026-03-27

## Context

By the end of Phase 4, Runroot already had stable package-level seams for runtime orchestration, tool invocation, approvals, and replay. Phase 5 needs API and CLI entrypoints plus the first real workflow templates.

The main risk in this phase is duplication:

- putting workflow logic into `apps/api`
- putting a second operator stack into `packages/cli`
- letting templates bypass runtime and talk directly to persistence

That would make Phase 6 harder because the web console would have to choose between competing service stacks.

## Decision

Runroot will keep Phase 5 surfaces thin:

1. `apps/api` only maps HTTP requests to package-level operator calls.
2. `packages/cli` only parses arguments, dispatches commands, and formats output.
3. `packages/templates` owns the first workflow catalog and template-specific tool assembly.
4. `packages/sdk` owns the shared operator service used by both API and CLI.
5. Local developer usability is backed by a minimal JSON-file runtime persistence adapter so repeated CLI calls and API requests can share state without introducing a full product database layer.

## Consequences

### Positive

- API and CLI reuse the same operator path.
- Templates stay close to runtime, tools, approvals, and replay.
- The repository gains real end-to-end workflows without inventing a second application service stack.
- Later product surfaces can build on the same package-level seams.

### Negative

- The local JSON workspace persistence adapter is intentionally minimal and not a production database strategy.
- Cross-process coordination is only good enough for local operator usage, not for multi-tenant or highly concurrent deployments.

## Boundaries

- `apps/api` must not implement workflow state transitions.
- `packages/cli` must not implement runtime, approval, or replay logic.
- `packages/templates` may assemble tools and workflow definitions, but it must not write directly to persistence.
- `packages/sdk` may coordinate runtime, templates, approvals, and replay, but it must not become a new product platform layer.

## Deferred

- authenticated API surface
- remote SDK clients
- template marketplace concerns
- richer CLI UX or TUI
- web console and observability UI
