# Runroot AGENTS

## Project Positioning

Runroot is an MCP-native agent runtime and orchestration platform for developer and ops workflows. The project focuses on durable execution, pause/resume, human approval, replay, tool calling, MCP integration, and observability.

This repository is infrastructure-first. It is not a chat UI product and it is not a prompt-packaging demo.

## Repository Boundaries

The repository will be organized as a TypeScript monorepo with strict package boundaries.

Expected top-level layout:

- `apps/`: deployable surfaces such as API and web console
- `packages/`: reusable runtime, domain, persistence, tools, approvals, replay, SDK, and templates
- `docs/`: architecture, ADRs, contributor guides, roadmap
- `examples/`: minimal end-to-end reference projects
- `.github/`: CI, issue templates, PR template

Do not couple `apps/` directly to storage or tool implementations. Core runtime logic must live in packages.

## Architectural Rules

1. Keep `core runtime` independent from API, CLI, and web layers.
2. Route all external integrations through adapters/providers.
3. Model `run`, `step`, `tool call`, `approval`, and `event` as explicit domain concepts.
4. Every state transition must be testable and replayable.
5. Optimize for idempotency, recoverability, and auditability before feature breadth.
6. Prefer boring technology and low-maintenance abstractions.
7. Do not add abstraction layers that are not justified by a real boundary.

## Phase Discipline

The project is executed in phases. Only work on the current phase.

- Phase 0: blueprint, boundaries, repo strategy, ADR backlog
- Phase 1: scaffold and engineering foundations
- Phase 2: runtime core
- Phase 3: tool layer and MCP
- Phase 4: approvals and replay
- Phase 5: API, CLI, templates
- Phase 6: web console and observability
- Phase 7: Open-Source Polish and Release Readiness
- Phase 8: Postgres-First Persistence and SQLite Development Fallback
- Phase 9: Queue-Backed Execution and Worker Coordination
- Phase 10: Persisted Tool History and Execution Telemetry
- Phase 11: Correlated Audit Projections and Operator Views
- Phase 12: Cross-Run Audit Queries and Filters
- Phase 13: Cross-Run Audit Drilldowns and Identifier Queries
- Phase 14: Cross-Run Audit Navigation and Linked Operator Views
- Phase 15: Cross-Run Audit Saved Views and Operator Presets
- Phase 16: Cross-Run Audit View Catalogs and Curated Operator Presets
- Phase 17: Cross-Run Audit Catalog Visibility and Shared Presets
- Phase 18: Cross-Run Audit Catalog Review Signals and Shared Notes
- Phase 19: Cross-Run Audit Catalog Review Assignments and Operator Handoffs
- Phase 20: Cross-Run Audit Catalog Assignment Checklists and Handoff Statuses
- Phase 21: Cross-Run Audit Catalog Checklist Item Progress and Completion Notes

Do not pull work from later phases into the current phase unless it is required to unblock the current phase and the reason is documented.

## Code Style

- Use TypeScript `strict`
- Prefer small modules with explicit names
- Avoid default exports unless the framework strongly expects them
- Keep public APIs narrow and documented
- Use structured logging
- Keep comments short and only where they add real context

## Testing Requirements

Every phase should leave the repository with a runnable quality baseline for what exists in that phase.

Standard commands once scaffolded:

- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build`

For pre-scaffold phases, record command failures explicitly instead of treating them as success.

## Documentation Requirements

Important architecture and process decisions must be written down.

Required docs to maintain:

- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE`
- `docs/roadmap.md`
- `docs/architecture/*`
- `docs/architecture/adr-*`

## Definition Of Done

A phase is not done unless all applicable items are true:

1. The phase goal is implemented or documented.
2. Relevant docs are updated.
3. Lint passes.
4. Typecheck passes.
5. Tests pass.
6. Build passes.
7. Package and module boundaries remain clear.
8. Important tradeoffs are documented.
9. Known risks are called out.
10. The next phase is clearly defined.

## Non-Goals For The First 90 Days

- Consumer chat UI
- Multi-tenant SaaS billing
- Broad vendor lock-in to one model provider
- Complex multi-cloud deployment matrix
- Overdesigned frontend work
- "General purpose agent platform" positioning without concrete workflows

## Working Norms

- Default to maintainability over novelty.
- Keep local development simple.
- Favor contributors who can reason about one package at a time.
- Treat docs and ADRs as first-class deliverables.
