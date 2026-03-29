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

Phase 13 (Cross-Run Audit Drilldowns and Identifier Queries) is complete on
this branch. The
repository now includes:

- the Phase 2 runtime core for runs, steps, checkpoints, and retries
- the Phase 3 tool layer and minimal MCP adapter
- the Phase 4 approval and replay foundations
- a thin operator API and CLI
- the first real workflow templates for GitHub, Slack, and shell automation
- a minimal web console for runs, approvals, and replay
- observability adapter seams for logging and tracing
- contributor onboarding guides and example guidance for open-source collaboration
- issue and pull request templates for public contribution flow
- a documented release-readiness workflow and release-note strategy
- a Postgres-first persistence baseline with a SQLite local-development fallback
- migration entrypoints and local infra guidance for the database-backed path
- a shared queue-backed execution seam and minimal worker coordination path
- a minimal worker app that can claim queued runs and drive them through the existing runtime
- persisted tool history and minimal telemetry correlation across inline and
  queued execution
- a correlated audit projection that joins replay, approval, dispatch, worker,
  and tool facts through the existing operator seams
- a minimal operator-facing audit view in SDK, API, CLI, and web
- shared cross-run audit queries and thin operator-facing filters in SDK, API,
  CLI, and web
- shared cross-run audit drilldowns and identifier-constrained operator reads
  in SDK, API, CLI, and web

Persisted tool history is additive audit data. It does not become part of the
shared replay or approval source of truth.

Correlated audit views are also additive. They do not redefine replay or
approval correctness.

Cross-run audit queries remain derived operator read models. They do not become
replay, approval, or workflow-state source of truth.

Identifier-driven audit drilldowns remain derived operator read models as well.
They do not become replay, approval, or workflow-state source of truth.

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
pnpm dev
```

Operator examples:

```bash
pnpm --filter @runroot/cli dev templates list
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
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
- `apps/worker`: minimal queued-execution worker surface
- `packages/*`: runtime, domain, persistence, dispatch, events, tools, approvals, replay, observability, SDK, CLI, and templates
- `docs/architecture`: system design docs and ADRs

The core rule is simple: runtime concerns stay in packages, and apps remain thin transport and presentation layers.

Phase 3 adds one more rule: runtime can depend on the shared tool invocation contract, but concrete tool implementations and MCP translation stay outside `@runroot/core-runtime`.

Phase 4 adds a second rule: approval facts enter the shared runtime event stream, while tool lifecycle hooks remain package-level hooks until a later phase proves they belong in persisted replay history.

Phase 5 adds a third rule: API and CLI remain thin operator surfaces, while workflow templates are assembled in packages and reused through a shared operator service.

Phase 6 adds a fourth rule: the web console stays a thin visualization layer over the API surface, and observability begins as logging and tracing adapters rather than a new runtime center.

Phase 8 adds a fifth rule: database-backed persistence must stay behind the shared persistence contracts. Postgres is the primary backing store, SQLite is the local-development fallback, and the JSON-file adapter is no longer the default operator path.

Phase 9 adds a sixth rule: queued execution must stay behind shared dispatch and worker seams. Runs may execute out of process, but replay, approval, and operator semantics still derive from persisted runtime and approval events.

Phase 10 adds a seventh rule: persisted tool history remains additive to replay.
It can record scoped tool outcomes and telemetry correlation, but replay and
approval still derive only from persisted runtime and approval events.

Phase 11 adds an eighth rule: correlated audit views stay derived and
operator-facing. They can join replay facts with additive dispatch, worker, and
tool-history records, but they do not become a second workflow-state model.

Phase 12 adds a ninth rule: cross-run audit queries stay thin and structured.
They can filter or summarize derived audit facts across runs, but they do not
expand into a dashboard, analytics suite, or backend observability platform.

Phase 13 adds a tenth rule: identifier-driven drilldowns stay constrained and
operator-facing. They can narrow derived audit facts by stable identifiers, but
they do not expand into a dashboard, search product, or analytics platform.

## Example Use Cases

- GitHub issue triage with optional human approval
- Pull request review workflows with durable checkpoints
- Slack approval and resume for sensitive operations
- Shell-driven runbooks with audit trails

## Guides

- [Quickstart](./docs/guides/quickstart.md)
- [Contributor Onboarding](./docs/guides/contributor-onboarding.md)
- [Good First Issues](./docs/guides/good-first-issues.md)
- [API Usage](./docs/guides/api-usage.md)
- [CLI Usage](./docs/guides/cli-usage.md)
- [Templates](./docs/guides/templates.md)
- [Web Console](./docs/guides/web-console.md)
- [Observability](./docs/guides/observability.md)
- [Persistence Baseline](./docs/guides/persistence-baseline.md)
- [Queued Execution](./docs/guides/queued-execution.md)
- [Tool Telemetry](./docs/guides/tool-telemetry.md)
- [Audit Projections](./docs/guides/audit-projections.md)
- [Audit Queries](./docs/guides/audit-queries.md)
- [Audit Drilldowns](./docs/guides/audit-drilldowns.md)
- [Release Readiness](./docs/guides/release-readiness.md)
- [Examples](./examples/README.md)
- [Web Console](./docs/architecture/web-console.md)
- [Observability](./docs/architecture/observability.md)

## Roadmap

The current roadmap is maintained in [docs/roadmap.md](./docs/roadmap.md). The architecture baseline for this phase lives in [phase-0-blueprint.md](./docs/architecture/phase-0-blueprint.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for environment setup, coding standards, test expectations, and documentation requirements.

For the most useful contributor entrypoints, start with:

- [Contributor Onboarding](./docs/guides/contributor-onboarding.md)
- [Good First Issues](./docs/guides/good-first-issues.md)
- [Examples](./examples/README.md)
- [Templates Guide](./docs/guides/templates.md)
- [Release Readiness](./docs/guides/release-readiness.md)
- [Security Policy](./SECURITY.md)
- [Code Of Conduct](./CODE_OF_CONDUCT.md)
