# Roadmap

## Phase 1: Scaffold And Foundations

- establish the pnpm workspace and package boundaries
- land contributor docs, architecture docs, and core ADRs
- provide a minimal Fastify API and Next.js web shell
- make install, bootstrap, lint, typecheck, test, integration test, and build reproducible

Status: completed

## Phase 2: Runtime Core

- implement run and step models
- add state transitions, retry policy, checkpoints, and event logging
- introduce persistence contracts and local adapters

Status: completed

## Phase 3: Tool Layer And MCP

- add the shared tool contract and registry
- integrate MCP client adapters
- ship local and MCP-backed tool examples

Status: completed

## Phase 4: Human Approval And Replay

- add approval request and decision flows
- support pause, await approval, and resume
- expose replayable run timelines

Status: completed

## Phase 5: API, CLI, And Templates

- expose operator APIs and a usable CLI
- add end-to-end workflow templates for GitHub, Slack, and shell scenarios

## Phase 6: Web Console And Observability

- add run lists, run detail, approval queue, and timeline views
- expose logging and tracing adapters

## Phase 7: Open Source Polish

- tighten docs, examples, issue templates, PR templates, and release workflows
- publish contributor onboarding and good-first-issue guidance
