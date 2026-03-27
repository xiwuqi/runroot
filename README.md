# Runroot

Runroot is an MCP-native runtime and orchestration platform for durable developer and ops workflows.

## Why Runroot

Most agent tooling still optimizes for short-lived chats, not long-running operational workflows. Runroot is designed for teams that need a self-hosted runtime with durable execution, explicit approvals, replayable history, and clean integration boundaries.

Runroot focuses on:

- durable run execution with pause and resume
- human approval paths instead of hidden side effects
- replayable event history for audit and debugging
- MCP-native tool integration
- boring, maintainable infrastructure suitable for small teams and open-source contributors

## Current Status

Phase 4 is complete. The repository now includes the Phase 2 runtime core, the Phase 3 tool layer, and the first approval and replay foundations:

- steps can request approval through a dedicated runtime seam
- pending approvals are persisted together with paused run state and approval events
- operator code can record approval decisions, query approval state, and resume approved runs
- replay timelines are projected from persisted runtime events

Tool invocation hooks remain in-memory hooks inside `@runroot/tools`; they are not yet part of the shared replay source of truth.

## Planned Capabilities

- Runtime core for runs, steps, retry, checkpoints, and event logging
- Tool layer for local tools and MCP-backed tools
- Approval model for pause, decision, resume, and rejection
- Replay and timeline views backed by immutable events
- API, CLI, and a minimal web console
- Practical templates for GitHub triage, PR review, Slack approvals, and shell runbooks

## Quick Start

```bash
pnpm install
pnpm bootstrap
pnpm infra:up
pnpm dev
```

Quality commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

## Architecture Overview

Runroot is organized as a TypeScript monorepo:

- `apps/api`: Fastify-based control plane API
- `apps/web`: Next.js console for runs and approvals
- `packages/*`: runtime, domain, persistence, events, tools, approvals, replay, observability, SDK, CLI, and templates
- `docs/architecture`: system design docs and ADRs

The core rule is simple: runtime concerns stay in packages, and apps remain thin transport and presentation layers.

Phase 3 adds one more rule: runtime can depend on the shared tool invocation contract, but concrete tool implementations and MCP translation stay outside `@runroot/core-runtime`.

Phase 4 adds a second rule: approval facts enter the shared runtime event stream, while tool lifecycle hooks remain package-level hooks until a later phase proves they belong in persisted replay history.

## Example Use Cases

- GitHub issue triage with optional human approval
- Pull request review workflows with durable checkpoints
- Slack approval and resume for sensitive operations
- Shell-driven runbooks with audit trails

## Roadmap

The current roadmap is maintained in [docs/roadmap.md](./docs/roadmap.md). The architecture baseline for this phase lives in [phase-0-blueprint.md](./docs/architecture/phase-0-blueprint.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for environment setup, coding standards, test expectations, and documentation requirements.
