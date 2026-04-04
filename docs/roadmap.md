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

Status: completed

## Phase 15: Cross-Run Audit Saved Views and Operator Presets

- add a shared saved-view and operator-preset contract over the existing audit
  navigation path rather than snapshotting audit facts into a second source of
  truth
- expose minimal save, list, load, and apply paths through the existing seams
  in SDK, API, CLI, and web
- keep operator surfaces thin while allowing constrained audit investigations
  to be reopened through stable presets instead of surface-specific bookmarks
- execute against the formal handoff in
  [docs/architecture/phase-15-handoff.md](./architecture/phase-15-handoff.md)
- keep the phase focused on saved audit views and operator presets rather than
  a full observability backend, productized dashboard, or open-ended search
  and analytics product

Status: completed

## Phase 16: Cross-Run Audit View Catalogs and Curated Operator Presets

- add a shared audit-view catalog contract over the existing saved-view path
  rather than snapshotting audit facts into a second source of truth
- expose minimal publish, list, inspect, archive, and apply paths through the
  existing seams in SDK, API, CLI, and web
- keep operator surfaces thin while making curated audit presets discoverable
  across surfaces without expanding into a full dashboard, search, or analytics
  product
- execute against the formal handoff in
  [docs/architecture/phase-16-handoff.md](./architecture/phase-16-handoff.md)
- keep the phase focused on catalog entries and curated operator presets rather
  than collaborative sharing, RBAC, SaaS catalogs, or broad observability and
  analytics platform work

Status: completed

## Phase 17: Cross-Run Audit Catalog Visibility and Shared Presets

- add a shared catalog-visibility contract over the existing audit-view catalog
  path rather than introducing a standalone collaboration product or workflow
  state model
- expose minimal share, list-visible, inspect, unshare, and apply paths
  through the existing seams in SDK, API, CLI, and web
- keep operator surfaces thin while making curated presets visible across
  operators without expanding into fine-grained RBAC, SaaS catalogs, search,
  dashboards, or analytics products
- execute against the formal handoff in
  [docs/architecture/phase-17-handoff.md](./architecture/phase-17-handoff.md)
- keep the phase focused on catalog visibility and shared presets rather than
  collaborative comments, multi-user curation, or broad platform work

Status: completed

## Phase 18: Cross-Run Audit Catalog Review Signals and Shared Notes

- add a shared audit-catalog review-signal contract over the existing catalog
  visibility path rather than introducing a full collaboration or approval
  product
- expose minimal review, list-reviewed, inspect-review, clear-review, and
  apply paths through the existing seams in SDK, API, CLI, and web
- keep operator surfaces thin while allowing shared presets to carry light
  review cues and notes without expanding into fine-grained RBAC,
  multi-tenant access, dashboard, search, or analytics products
- execute against the formal handoff in
  [docs/architecture/phase-18-handoff.md](./architecture/phase-18-handoff.md)
- keep the phase focused on review signals and shared notes rather than
  threaded collaboration, SaaS catalogs, or broad observability and analytics
  platform work

Status: completed

## Phase 19: Cross-Run Audit Catalog Review Assignments and Operator Handoffs

- add a shared audit-catalog review-assignment contract over the existing
  review-signal and visibility paths rather than introducing a collaborative
  review product or permission framework
- expose minimal assign, list-assigned, inspect-assignment, clear-assignment,
  and apply paths through the existing seams in SDK, API, CLI, and web
- keep operator surfaces thin while allowing reviewed shared presets to be
  handed off to a specific operator through stable assignment metadata without
  expanding into threaded collaboration, fine-grained RBAC, multi-tenant
  access, dashboards, search, or analytics products
- execute against the formal handoff in
  [docs/architecture/phase-19-handoff.md](./architecture/phase-19-handoff.md)
- keep the phase focused on review assignments and operator handoffs rather
  than threaded comments, review workflows, broader multi-user curation, or
  broad observability and analytics platform work

Status: completed

## Phase 20: Cross-Run Audit Catalog Assignment Checklists and Handoff Statuses

- add a shared audit-catalog assignment-checklist contract over the existing
  review-assignment and review-signal paths rather than introducing a review
  workflow engine or collaboration product
- expose minimal checklist, list-checklisted, inspect-checklist,
  clear-checklist, and apply paths through the existing seams in SDK, API,
  CLI, and web
- keep operator surfaces thin while allowing assigned reviewed presets to carry
  stable handoff checklist items and checklist status without expanding into
  threaded collaboration, fine-grained RBAC, multi-tenant access, dashboards,
  search, or analytics products
- execute against the formal handoff in
  [docs/architecture/phase-20-handoff.md](./architecture/phase-20-handoff.md)
- keep the phase focused on assignment checklists and handoff statuses rather
  than threaded comments, broader review workflow engines, broader multi-user
  curation, or broad observability and analytics platform work

Status: completed

## Phase 21: Cross-Run Audit Catalog Checklist Item Progress and Completion Notes

- add a shared audit-catalog checklist-item-progress contract over the existing
  assignment-checklist and review-assignment paths rather than introducing a
  broader review workflow engine or threaded collaboration product
- expose minimal progress, list-progressed, inspect-progress, clear-progress,
  and apply paths through the existing seams in SDK, API, CLI, and web
- keep operator surfaces thin while allowing assigned reviewed presets to
  carry stable per-item checklist progress and a thin completion note without
  expanding into threaded collaboration, fine-grained RBAC, multi-tenant
  access, dashboards, search, or analytics products
- execute against the formal handoff in
  [docs/architecture/phase-21-handoff.md](./architecture/phase-21-handoff.md)
- keep the phase focused on checklist item progress and completion notes
  rather than broader checklist orchestration, broader review workflow
  engines, broader multi-user curation, or broad observability and analytics
  platform work

Status: completed

## Phase 22: Cross-Run Audit Catalog Checklist Item Blockers and Blocker Notes

- add a shared audit-catalog checklist-item-blocker contract over the existing
  checklist-item-progress and assignment-checklist paths rather than
  introducing broader checklist orchestration or a workflow engine
- expose minimal block, list-blocked, inspect-blocker, clear-blocker, and
  apply paths through the existing seams in SDK, API, CLI, and web
- keep operator surfaces thin while allowing progressed assigned presets to
  carry stable per-item blocker state and a thin blocker note without
  expanding into threaded collaboration, fine-grained RBAC, multi-tenant
  access, dashboards, search, or analytics products
- execute against the formal handoff in
  [docs/architecture/phase-22-handoff.md](./architecture/phase-22-handoff.md)
- keep the phase focused on checklist item blockers and blocker notes rather
  than broader checklist orchestration, broader review workflow engines,
  broader multi-user curation, or broad observability and analytics platform
  work

Status: completed

## Phase 23: Cross-Run Audit Catalog Checklist Item Resolutions and Resolution Notes

- add a shared audit-catalog checklist-item-resolution contract over the
  existing checklist-item-blocker and checklist-item-progress paths rather than
  introducing broader checklist orchestration or a workflow engine
- expose minimal resolve, list-resolved, inspect-resolution,
  clear-resolution, and apply paths through the existing seams in SDK, API,
  CLI, and web
- keep operator surfaces thin while allowing blocked progressed assigned
  presets to carry stable per-item resolution state and a thin resolution note
  without expanding into threaded collaboration, fine-grained RBAC,
  multi-tenant access, dashboards, search, or analytics products
- execute against the formal handoff in
  [docs/architecture/phase-23-handoff.md](./architecture/phase-23-handoff.md)
- keep the phase focused on checklist item resolutions and resolution notes
  rather than broader checklist orchestration, broader review workflow
  engines, broader multi-user curation, or broad observability and analytics
  platform work

Status: completed

## Phase 24: Cross-Run Audit Catalog Checklist Item Verifications and Verification Notes

- add a shared audit-catalog checklist-item-verification contract over the
  existing checklist-item-resolution and checklist-item-blocker paths rather
  than introducing broader checklist orchestration or a workflow engine
- expose minimal verify, list-verified, inspect-verification,
  clear-verification, and apply paths through the existing seams in SDK, API,
  CLI, and web
- keep operator surfaces thin while allowing resolved blocked progressed
  assigned presets to carry stable per-item verification state and a thin
  verification note without expanding into threaded collaboration,
  fine-grained RBAC, multi-tenant access, dashboards, search, or analytics
  products
- execute against the formal handoff in
  [docs/architecture/phase-24-handoff.md](./architecture/phase-24-handoff.md)
- keep the phase focused on checklist item verifications and verification
  notes rather than broader checklist orchestration, broader review workflow
  engines, broader multi-user curation, or broad observability and analytics
  platform work

Status: completed

## Phase 25: Cross-Run Audit Catalog Checklist Item Evidence References and Evidence Notes

- add a shared audit-catalog checklist-item-evidence contract over the
  existing checklist-item-verification and checklist-item-resolution paths
  rather than introducing broader checklist orchestration, an artifact vault,
  or a workflow engine
- expose minimal record-evidence, list-evidenced, inspect-evidence,
  clear-evidence, and apply paths through the existing seams in SDK, API, CLI,
  and web
- keep operator surfaces thin while allowing verified resolved blocked
  progressed assigned presets to carry stable per-item evidence references and
  a thin evidence note without expanding into threaded collaboration,
  fine-grained RBAC, multi-tenant access, dashboards, search, analytics, or
  provider-payload persistence
- execute against the formal handoff in
  [docs/architecture/phase-25-handoff.md](./architecture/phase-25-handoff.md)
- keep the phase focused on checklist item evidence references and evidence
  notes rather than broader checklist orchestration, broader review workflow
  engines, broader multi-user curation, or broad observability and analytics
  platform work

Status: completed

## Phase 26: Cross-Run Audit Catalog Checklist Item Attestations and Attestation Notes

- add a shared audit-catalog checklist-item-attestation contract over the
  existing checklist-item-evidence and checklist-item-verification paths
  rather than introducing provider-payload persistence, an artifact vault, or
  a workflow engine
- expose minimal attest, list-attested, inspect-attestation,
  clear-attestation, and apply paths through the existing seams in SDK, API,
  CLI, and web
- keep operator surfaces thin while allowing evidenced verified resolved
  blocked progressed assigned presets to carry stable per-item attestation
  state and a thin attestation note without expanding into threaded
  collaboration, fine-grained RBAC, multi-tenant access, dashboards, search,
  analytics, or copied binary artifact persistence
- execute against the formal handoff in
  [docs/architecture/phase-26-handoff.md](./architecture/phase-26-handoff.md)
- keep the phase focused on checklist item attestations and attestation notes
  rather than broader checklist orchestration, broader review workflow
  engines, broader multi-user curation, artifact-vault products, or broad
  observability and analytics platform work

Status: completed

## Phase 27: Cross-Run Audit Catalog Checklist Item Acknowledgments and Acknowledgment Notes

- add a shared audit-catalog checklist-item-acknowledgment contract over the
  existing checklist-item-attestation and checklist-item-evidence paths rather
  than introducing approval gating, artifact-vault behavior, or a workflow
  engine
- expose minimal acknowledge, list-acknowledged, inspect-acknowledgment,
  clear-acknowledgment, and apply paths through the existing seams in SDK,
  API, CLI, and web
- keep operator surfaces thin while allowing attested evidenced verified
  resolved blocked progressed assigned presets to carry stable per-item
  acknowledgment state and a thin acknowledgment note without expanding into
  threaded collaboration, fine-grained RBAC, multi-tenant access, dashboards,
  search, analytics, or attachment-upload products
- execute against the formal handoff in
  [docs/architecture/phase-27-handoff.md](./architecture/phase-27-handoff.md)
- keep the phase focused on checklist item acknowledgments and acknowledgment
  notes rather than broader checklist orchestration, broader review workflow
  engines, broader multi-user curation, approval products, or broad
  observability and analytics platform work

Status: completed

## Phase 28: Cross-Run Audit Catalog Checklist Item Sign-Offs and Sign-Off Notes

- add a shared audit-catalog checklist-item-signoff contract over the existing
  checklist-item-acknowledgment and checklist-item-attestation paths rather
  than introducing approval products, workflow gating, or a workflow engine
- expose minimal sign-off, list-signed-off, inspect-sign-off, clear-sign-off,
  and apply paths through the existing seams in SDK, API, CLI, and web
- keep operator surfaces thin while allowing acknowledged attested evidenced
  verified resolved blocked progressed assigned presets to carry stable
  per-item sign-off state and a thin sign-off note without expanding into
  threaded collaboration, fine-grained RBAC, multi-tenant access, dashboards,
  search, analytics, approval products, workflow gating, or attachment-upload
  products
- execute against the formal handoff in
  [docs/architecture/phase-28-handoff.md](./architecture/phase-28-handoff.md)
- keep the phase focused on checklist item sign-offs and sign-off notes rather
  than broader checklist orchestration, broader review workflow engines,
  broader multi-user curation, approval products, workflow gating, or broad
  observability and analytics platform work

Status: completed

## Phase 29: Cross-Run Audit Catalog Checklist Item Exceptions and Exception Notes

- add a shared audit-catalog checklist-item-exception
  contract over the existing checklist-item-signoff,
  checklist-item-acknowledgment, and checklist-item-attestation paths rather
  than introducing approval
  products, workflow gating, or a workflow engine
- expose minimal record-exception, list-excepted, inspect-exception,
  clear-exception, and apply paths through the existing seams in SDK, API,
  CLI, and web
- keep operator surfaces thin while allowing signed-off acknowledged attested
  evidenced verified resolved blocked progressed assigned reviewed presets to
  carry stable per-item exception state and a thin exception note without
  expanding into threaded collaboration, fine-grained RBAC, multi-tenant
  access, dashboards, search, analytics, approval products, workflow gating,
  or attachment-upload products
- execute against the formal handoff in
  [docs/architecture/phase-29-handoff.md](./architecture/phase-29-handoff.md)
- keep the phase focused on checklist item exceptions and exception notes
  rather than broader checklist orchestration, broader review workflow
  engines, broader multi-user curation, approval products, workflow gating,
  or broad observability and analytics platform work

Status: completed
