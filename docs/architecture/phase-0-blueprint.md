# Runroot Phase 0 Blueprint

## One-line Positioning

Runroot is an MCP-native runtime and orchestration platform for durable developer and ops workflows.

## Product Scope

Primary users:

- developers building workflow agents
- small teams automating internal tooling and operational workflows
- engineering teams that need self-hosted, auditable, resumable runtime infrastructure

Initial first-class workflows:

1. GitHub issue triage
2. GitHub pull request review workflow
3. Slack approval and resume workflow
4. Shell and CLI runbook automation

Explicit non-goals for the first 90 days:

- consumer chat UX
- multi-tenant SaaS platform concerns
- billing
- broad cloud deployment matrix
- model-vendor-specific architecture

## Architecture Principles

1. Core runtime stays independent from transport and presentation.
2. Persistence, events, tools, approvals, replay, and observability are separate packages.
3. External systems are integrated via adapters/providers.
4. All state transitions are deterministic enough to audit and replay.
5. Storage is Postgres-first, with SQLite fallback only for local development.
6. Prefer simple interfaces that can survive open-source contribution over clever abstractions.

## Recommended Technical Stack

Default stack for the first implementation:

- Monorepo: pnpm workspaces, without Turborepo in Phase 1
- Language: TypeScript with `strict` enabled
- Runtime: Node.js 20 LTS baseline
- API: Fastify
- Web console: Next.js App Router
- ORM and migrations: Drizzle ORM with Drizzle Kit
- Database: Postgres primary, SQLite local fallback adapter
- Logging: Pino structured logging
- Tracing: OpenTelemetry
- Testing: Vitest for unit and integration, Playwright only when the web console reaches useful flows
- Lint and format: Biome
- Package releases: Changesets
- CLI: Commander
- Local dev execution: `tsx`

Selection rationale:

- Fastify, Pino, and OpenTelemetry fit well together and keep the API surface small.
- Drizzle handles Postgres and SQLite cleanly while keeping SQL visible and migrations explicit.
- Biome and Vitest keep contributor setup fast.
- Avoiding Turborepo in Phase 1 reduces moving parts until the workspace has enough packages to justify another orchestration layer.

## System Overview

Text architecture map:

`apps/api` and `packages/cli` submit workflow runs through application services.

Application services depend on:

- `packages/domain` for entities and value objects
- `packages/core-runtime` for orchestration, state transitions, retry, checkpoint, pause/resume
- `packages/tools` for tool registry and normalized execution contracts
- `packages/mcp` for MCP transport and tool discovery/invocation
- `packages/approvals` for approval requests, decisions, and resume paths
- `packages/replay` for timeline and replay reconstruction
- `packages/persistence` for repositories, event store, and checkpoint storage
- `packages/observability` for logging, traces, and event export

`apps/web` consumes API endpoints only. It does not read the database directly.

## Recommended Monorepo Structure

```text
/
  apps/
    api/
    web/
  packages/
    domain/
    core-runtime/
    persistence/
    events/
    tools/
    mcp/
    approvals/
    replay/
    observability/
    sdk/
    cli/
    templates/
    config/
    test-utils/
  docs/
    architecture/
      adr-0001-monorepo-and-stack.md
      adr-0002-domain-boundaries.md
      adr-0003-persistence-and-eventing.md
      system-overview.md
      runtime-lifecycle.md
      tool-execution.md
      approval-flow.md
      replay-model.md
      extension-model.md
    guides/
    roadmap.md
  examples/
    github-issue-triage/
    pr-review-flow/
    slack-approval-flow/
    shell-runbook/
  .github/
    workflows/
    ISSUE_TEMPLATE/
    pull_request_template.md
```

Why this structure:

- `packages/domain` centralizes shared business language without leaking framework details.
- `packages/core-runtime` remains deploy-surface agnostic.
- `packages/events` and `packages/persistence` separate "what happened" from "where it is stored".
- `packages/templates` keeps workflow assembly examples separate from the runtime internals.
- `apps/*` stay thin and replaceable.

## Domain Model Draft

Core entities:

- `Run`: one workflow execution instance with status, inputs, policy, and metadata
- `Step`: one executable or waiting unit inside a run
- `Checkpoint`: persisted resumable point for a run or step
- `Event`: immutable record of state change or significant action
- `ToolCall`: normalized request/response for tool invocation
- `ApprovalRequest`: request awaiting human decision
- `ApprovalDecision`: approve, reject, cancel, or timeout outcome
- `ReplaySession`: reconstructed view of a run history

Suggested run states:

- `pending`
- `queued`
- `running`
- `paused`
- `waiting_for_approval`
- `succeeded`
- `failed`
- `cancelled`

Suggested step states:

- `idle`
- `ready`
- `running`
- `retry_scheduled`
- `waiting_for_approval`
- `paused`
- `completed`
- `failed`
- `cancelled`

Important value objects:

- `RunId`
- `StepId`
- `ToolCallId`
- `ApprovalRequestId`
- `RetryPolicy`
- `CheckpointToken`
- `ActorRef`
- `CorrelationId`

## Boundary Design

### API Boundary

Responsibilities:

- accept run creation and control requests
- expose run timeline, approvals, and replay views
- validate transport inputs
- map transport DTOs to application commands

Must not:

- contain state machine logic
- talk to database tables directly
- know tool-specific execution details

### Runtime Boundary

Responsibilities:

- execute run and step lifecycle
- apply retry policy
- emit domain events
- persist checkpoints through abstractions
- pause, resume, cancel, and restart runs

Must not:

- know HTTP or UI concerns
- embed GitHub, Slack, or MCP transport logic

### Tool Boundary

Responsibilities:

- register local and remote tools
- normalize invocation input/output
- enforce allowlist and permission policy
- surface tool execution metadata

Must not:

- own run orchestration
- embed approval policy

### MCP Boundary

Responsibilities:

- manage MCP client sessions
- discover server tools and metadata
- translate MCP calls into the tool contract
- isolate MCP transport concerns from runtime

Must not:

- bypass the shared tool registry

### Approval Boundary

Responsibilities:

- create approval requests
- store approver identity and decision reason
- move runs into waiting/resumable states

Must not:

- own workflow graph execution

### Replay Boundary

Responsibilities:

- rebuild a run timeline from immutable events
- provide timeline views and replay metadata
- support debugging and audit trails

Must not:

- mutate live runtime state

## First API Surface Draft

Initial HTTP resources for later phases:

- `POST /runs`
- `GET /runs`
- `GET /runs/:runId`
- `POST /runs/:runId/pause`
- `POST /runs/:runId/resume`
- `POST /runs/:runId/cancel`
- `GET /runs/:runId/events`
- `GET /runs/:runId/timeline`
- `GET /approvals`
- `POST /approvals/:approvalRequestId/decide`

These endpoints should be thin wrappers over application commands and queries.

## Runtime Execution Model Draft

Execution loop expectations:

1. Create run record.
2. Persist initial event.
3. Materialize first ready step.
4. Execute step through runtime executor.
5. For tool steps, delegate to `packages/tools`.
6. Persist step result, emitted events, and checkpoint.
7. Apply transition rules.
8. Stop on terminal state or wait state.
9. Resume from checkpoint and event history.

Minimal retry policy for MVP:

- max attempts
- backoff strategy
- retryable error classification

## Persistence Strategy

Main database: Postgres.

Tables or collections expected later:

- `runs`
- `steps`
- `run_events`
- `checkpoints`
- `tool_calls`
- `approval_requests`
- `approval_decisions`

Phase 2 local-dev fallback:

- SQLite adapter implementing the same repository contracts

Eventing choice:

- application events are persisted in Postgres first
- external brokers are deferred
- event store acts as replay source of truth

Queue strategy:

- Phase 1 to Phase 4: in-process orchestration plus persistence contracts
- Redis/BullMQ or another external queue stays behind an abstraction and is deferred until throughput or isolation requirements prove it necessary

## Observability Strategy

Baseline:

- structured JSON logs
- OpenTelemetry tracing hooks
- correlation IDs across run, step, tool call, approval
- timeline query model derived from immutable events

Deferred:

- distributed queue tracing
- advanced metrics backend integrations
- full log shipping stack

## Development Command Design

Workspace-level commands to establish in Phase 1:

- `pnpm install`
- `pnpm dev`
- `pnpm infra:up`
- `pnpm infra:down`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:integration`
- `pnpm build`
- `pnpm ci`

Suggested command contract:

- `pnpm dev`: starts API and web in watch mode, with local dependencies documented
- `pnpm infra:up`: starts local Postgres and any required development services
- `pnpm infra:down`: stops local development services
- `pnpm test`: fast unit test suite only
- `pnpm test:integration`: database-backed integration tests
- `pnpm ci`: runs lint, typecheck, test, test:integration, and build in CI order

Package-level patterns:

- `pnpm --filter @runroot/api dev`
- `pnpm --filter @runroot/core-runtime test`
- `pnpm --filter @runroot/web build`

## First Template Design

### GitHub Issue Triage

Flow:

1. receive repository and issue trigger
2. fetch issue data through adapter
3. run classification and severity heuristics
4. optionally call MCP tools for context enrichment
5. propose labels/assignee/comment
6. request approval if policy requires
7. apply changes

### PR Review Workflow

Flow:

1. receive PR trigger
2. fetch diff, metadata, and CI summary
3. run analysis tools or MCP-backed review helpers
4. produce review summary
5. request approval before posting if configured
6. submit review outcome

### Slack Approval Flow

Flow:

1. runtime reaches approval step
2. send approval request via Slack adapter
3. pause run
4. receive decision webhook
5. resume or reject execution

### Shell Runbook Flow

Flow:

1. start run with operator inputs
2. execute shell steps under policy
3. checkpoint after each critical step
4. request approval before destructive actions
5. record command output references and completion state

## ADR Backlog

Phase 1 should open with these ADRs:

1. `adr-0001-monorepo-and-stack.md`
2. `adr-0002-domain-boundaries-and-package-layout.md`
3. `adr-0003-persistence-model-postgres-first-with-sqlite-dev-fallback.md`
4. `adr-0004-event-model-and-replay-source-of-truth.md`
5. `adr-0005-tool-execution-contract-and-mcp-adapter-boundary.md`
6. `adr-0006-observability-baseline-otel-and-structured-logging.md`
7. `adr-0007-api-and-cli-surface-strategy.md`
8. `adr-0008-template-scope-for-first-90-days.md`

## 90-Day Scope Control

Must ship in the first 90 days:

- a stable runtime core with pause/resume/retry/checkpoint
- a Postgres-backed event log and replay timeline
- MCP-native tool integration
- CLI plus API
- minimal web console for runs and approvals
- four real workflow templates
- contributor docs and release process

Must be deferred:

- multi-tenant auth model
- distributed queue infrastructure as a hard dependency
- visual drag-and-drop workflow builder
- marketplace or plugin registry UX
- model gateway productization
- fine-grained RBAC beyond basic operator/admin roles
- multi-region deployment design
- broad SaaS onboarding concerns

## Phase Plan

### Phase 1

- initialize pnpm workspace
- create `apps/api` and package skeletons
- add shared TypeScript config and lint/test/build baseline
- create README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, LICENSE, roadmap, first ADR
- add GitHub Actions baseline

### Phase 2

- implement runtime state machine, checkpoints, events, persistence contracts
- add unit and integration tests for retry and resume

### Phase 3

- implement tool registry, MCP adapter, local tool examples, allowlist policy

### Phase 4

- implement approvals, wait states, decision handling, replay timeline reconstruction

### Phase 5

- expose API and CLI, add four end-to-end templates

### Phase 6

- build web console and observability adapters

### Phase 7

- polish docs, examples, release workflow, issue templates, contributor onboarding

## Phase 1 File Plan

Concrete files to create in Phase 1:

- `package.json`
- `pnpm-workspace.yaml`
- `compose.yaml`
- `.env.example`
- `tsconfig.base.json`
- `.gitignore`
- `.editorconfig`
- `biome.json`
- `vitest.workspace.ts`
- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE`
- `docs/roadmap.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/runtime-lifecycle.md`
- `docs/architecture/tool-execution.md`
- `docs/architecture/approval-flow.md`
- `docs/architecture/replay-model.md`
- `docs/architecture/extension-model.md`
- `docs/architecture/adr-0001-monorepo-and-stack.md`
- `.github/workflows/ci.yml`
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/pull_request_template.md`
- `apps/api/package.json`
- `apps/api/src/server.ts`
- `apps/web/package.json`
- `apps/web/src/app/page.tsx`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/domain/package.json`
- `packages/domain/src/index.ts`
- `packages/core-runtime/package.json`
- `packages/core-runtime/src/index.ts`
- `packages/persistence/package.json`
- `packages/persistence/src/index.ts`
- `packages/events/package.json`
- `packages/events/src/index.ts`
- `packages/test-utils/package.json`
- `packages/test-utils/src/index.ts`

## Phase 0 Exit Criteria

Phase 0 is complete when:

1. the architecture blueprint is explicit
2. package boundaries are named
3. the first ADR set is defined
4. scope control is clear
5. Phase 1 file plan is concrete
6. quality command failures are recorded honestly because the scaffold does not exist yet
