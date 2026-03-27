# Contributing

## Start Here

Use these documents in order when you are new to the repository:

1. [README.md](./README.md)
2. [Contributor Onboarding](./docs/guides/contributor-onboarding.md)
3. [Phase 7 handoff](./docs/architecture/phase-7-handoff.md) when the current phase matters
4. [Templates guide](./docs/guides/templates.md) and [Examples](./examples/README.md) when you need a runnable workflow reference
5. [Security policy](./SECURITY.md) and [Code of conduct](./CODE_OF_CONDUCT.md)

## Development Environment

Required baseline:

- Node.js 20.19 or newer
- pnpm 10.32.1
- Docker and Docker Compose for local Postgres

Recommended setup:

1. `pnpm install`
2. `pnpm bootstrap`
3. `pnpm infra:up`
4. `pnpm dev`

## Development Workflow

1. Read `AGENTS.md` and relevant architecture docs before changing structure.
2. Document major architectural changes in an ADR before implementation.
3. Keep work inside the active phase. Do not pull later-phase runtime features into foundation changes.
4. Update user-facing and contributor docs alongside code changes.
5. Use the repository issue templates and PR template instead of ad hoc formats.

## Testing And Quality Gates

Run all of the following before asking for review:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build`

## Documentation Expectations

Contributors should update:

- package-level README files when package boundaries change
- `docs/architecture/*` when runtime, tool, approval, or replay contracts change
- `docs/roadmap.md` when milestones move
- ADRs when a significant tradeoff is chosen
- [examples/README.md](./examples/README.md) and example-specific notes when workflow samples change
- contributor guides when onboarding, examples, release flow, or collaboration expectations change

## Finding Work

- Start with [Good First Issues](./docs/guides/good-first-issues.md) if you are new to the repository.
- Use the GitHub issue templates for bugs, docs gaps, and feature requests so maintainers get reproducible context.
- If the work changes externally visible behavior or release-facing guidance, review [Release Readiness](./docs/guides/release-readiness.md) and the Changesets notes in [`.changeset/README.md`](./.changeset/README.md).

## Module Guide

- `apps/*` own transport and UI concerns
- `packages/domain` owns shared language and domain contracts
- `packages/core-runtime` will own orchestration semantics
- `packages/persistence` will own repositories and storage adapters
- `packages/tools` and `packages/mcp` will own tool invocation boundaries
- `packages/approvals` and `packages/replay` will own approval and replay models

## Pull Requests

Keep pull requests scoped, document tradeoffs, and avoid bundling unrelated changes. Small, well-documented increments are preferred over large drops.

Before asking for review:

1. confirm the change stays inside the active phase
2. run the required quality commands
3. update docs or examples if contributor expectations changed
4. explain release-note impact or why no release note is needed
