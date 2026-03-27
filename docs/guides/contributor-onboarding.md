# Contributor Onboarding

This guide is the shortest path for a new contributor who wants to understand
Runroot without relying on prior chat context.

## Read In This Order

1. [README.md](../../README.md)
2. [Phase 7 handoff](../architecture/phase-7-handoff.md) when you need the current phase contract
3. [Quickstart](./quickstart.md)
4. [Templates](./templates.md)
5. [Examples](../../examples/README.md)
6. [CONTRIBUTING.md](../../CONTRIBUTING.md)
7. [Security Policy](../../SECURITY.md)
8. [Code Of Conduct](../../CODE_OF_CONDUCT.md)

## Repository Map

- `apps/`: thin operator and UI surfaces
- `packages/`: runtime, tools, approvals, replay, observability, SDK, CLI, and templates
- `docs/`: roadmap, architecture docs, ADRs, and contributor guides
- `examples/`: input payloads and runnable reference material
- `.github/`: collaboration entrypoints and workflows

## First Local Session

1. install dependencies with `pnpm install`
2. bootstrap the workspace with `pnpm bootstrap`
3. read the current phase contract before proposing work that changes boundaries
4. use [Quickstart](./quickstart.md) to run the API, CLI, and web console
5. pick a small issue or docs improvement before changing architecture

## How To Pick Work

- Start with [Good First Issues](./good-first-issues.md) if you are unfamiliar with the repository.
- If the work changes a template or example, check [Templates](./templates.md) and [examples/README.md](../../examples/README.md) first.
- If the work changes repository process or release notes, check [Release Readiness](./release-readiness.md).

## What Not To Do

- Do not bypass phase discipline
- Do not move product logic into `apps/*`
- Do not widen scope from docs or repo process into new runtime or web features
- Do not assume tool hooks and replay history are the same thing

## Before Opening A PR

1. keep the change scoped
2. update docs and examples when contributor expectations change
3. run the required quality commands for the surfaces you touched
4. explain release-note impact or why none is needed
