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

Phase 2 is complete. The repository now includes the first usable runtime core: run and step models, retry policy, checkpoint flow, event logging, and persistence contracts with a reference in-memory adapter. Runtime transitions persist `run + events + optional checkpoint` through one atomic boundary in the reference store. Tool execution, approvals, and replay views remain intentionally deferred to later phases.

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

## Example Use Cases

- GitHub issue triage with optional human approval
- Pull request review workflows with durable checkpoints
- Slack approval and resume for sensitive operations
- Shell-driven runbooks with audit trails

## Roadmap

The current roadmap is maintained in [docs/roadmap.md](./docs/roadmap.md). The architecture baseline for this phase lives in [phase-0-blueprint.md](./docs/architecture/phase-0-blueprint.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for environment setup, coding standards, test expectations, and documentation requirements.
