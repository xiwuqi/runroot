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

Status: completed

## Phase 6: Web Console And Observability

- add run lists, run detail, approval queue, and timeline views
- expose logging and tracing adapters

Status: completed

## Phase 7: Open-Source Polish and Release Readiness

- tighten docs, examples, issue templates, PR templates, and release workflows
- publish contributor onboarding and good-first-issue guidance
- execute against the formal handoff in
  [docs/architecture/phase-7-handoff.md](./architecture/phase-7-handoff.md)
- keep Phase 7 implementation inside docs, examples, repository templates, and release-readiness assets

Status: completed

## Phase 8: Postgres-First Persistence and SQLite Development Fallback

- land Postgres as the primary persistence path for the existing runtime
  contracts
- add SQLite as the local-development fallback where practical
- document schema, migrations, and local infrastructure for the persistence
  baseline
- keep API, CLI, SDK, and web wired through the existing persistence seams
- execute against the formal handoff in
  [docs/architecture/phase-8-handoff.md](./architecture/phase-8-handoff.md)
- keep Phase 8 focused on persistence adapters, migrations, local infra, and
  thin wiring needed to use those adapters

Status: completed

## Phase 9: Queue-Backed Execution and Worker Coordination

- add a queue-backed execution or dispatch contract behind the existing runtime
  and operator seams
- add a minimum worker coordination path to execute runs outside the initiating
  request process
- keep replay, approval, and operator semantics stable while introducing queued
  execution
- execute against the formal handoff in
  [docs/architecture/phase-9-handoff.md](./architecture/phase-9-handoff.md)
- keep the phase focused on queue-backed execution, worker coordination, local
  infrastructure, and thin wiring

Status: completed

## Phase 10: Persisted Tool History and Execution Telemetry

- add a shared persisted tool-history path behind the existing tool hooks and
  package seams
- correlate run, step, dispatch job, worker, and tool identifiers through the
  existing observability adapters
- expose minimal read paths for tool audit history through the existing
  operator surfaces
- execute against the formal handoff in
  [docs/architecture/phase-10-handoff.md](./architecture/phase-10-handoff.md)
- keep the phase focused on persisted tool history, telemetry correlation, and
  thin wiring instead of a full observability platform

Status: completed

## Phase 11: Correlated Audit Projections and Operator Views

- add a shared correlated audit projection that joins replay timeline facts with
  additive dispatch, worker, and tool-history data without redefining replay
  source of truth
- expose minimal correlated audit read paths through the existing operator
  seams in SDK, API, CLI, and web
- keep the web console and operator surfaces thin while making inline and
  queued execution auditable through the same identifiers
- execute against the formal handoff in
  [docs/architecture/phase-11-handoff.md](./architecture/phase-11-handoff.md)
- keep the phase focused on audit projections, operator read paths, and thin
  presentation rather than a full observability backend or productized
  dashboard

Status: completed

## Phase 12: Cross-Run Audit Queries and Filters

- add a shared cross-run audit query or filter contract over the derived audit
  facts already established in replay, dispatch, worker, and tool-history
  seams
- expose minimal cross-run audit list and filter paths through the existing
  operator seams in SDK, API, CLI, and web
- keep operator surfaces thin while making inline and queued execution
  queryable through the same cross-run identifiers
- execute against the formal handoff in
  [docs/architecture/phase-12-handoff.md](./architecture/phase-12-handoff.md)
- keep the phase focused on cross-run audit queries, thin operator filters,
  and minimal presentation rather than a full observability backend,
  productized dashboard, or broad analytics product

Status: completed

## Phase 13: Cross-Run Audit Drilldowns and Identifier Queries

- add a shared cross-run audit drilldown and identifier-query contract over the
  derived audit facts already exposed through replay, dispatch, worker, and
  tool-history seams
- expose minimal operator-facing drilldown paths through the existing seams in
  SDK, API, CLI, and web
- keep operator surfaces thin while enabling constrained exploration by stable
  run, approval, step, dispatch, worker, and tool identifiers
- execute against the formal handoff in
  [docs/architecture/phase-13-handoff.md](./architecture/phase-13-handoff.md)
- keep the phase focused on identifier-driven audit drilldowns and minimal
  presentation rather than a full observability backend, productized dashboard,
  or open-ended search and analytics product

Status: completed

## Phase 14: Cross-Run Audit Navigation and Linked Operator Views

- add a shared cross-run audit navigation contract over the derived audit facts
  already exposed through replay, dispatch, worker, and tool-history seams
- expose minimal linked operator-view paths through the existing seams in SDK,
  API, CLI, and web
- keep operator surfaces thin while allowing constrained movement between
  cross-run summaries, identifier-driven drilldowns, and run-scoped audit views
- execute against the formal handoff in
  [docs/architecture/phase-14-handoff.md](./architecture/phase-14-handoff.md)
- keep the phase focused on audit navigation and linked operator views rather
  than a full observability backend, productized dashboard, or open-ended
  search and analytics product

Status: implemented on branch, pending phase review
