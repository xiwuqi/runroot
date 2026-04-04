# Phase 29: Cross-Run Audit Catalog Checklist Item Exceptions and Exception Notes

Status: repository-owned phase contract after scope freeze

This document records the repository-owned suggested execution contract for
Phase 29. It defines the minimum implementation boundary for a shared catalog
checklist-item-exception layer over the existing saved-view, navigation,
drilldown, run-scoped audit, catalog, catalog-visibility, catalog-review-
signal, catalog-review-assignment, assignment-checklist, checklist-item-
progress, checklist-item-blocker, checklist-item-resolution,
checklist-item-verification, checklist-item-evidence,
checklist-item-attestation, checklist-item-acknowledgment, and
checklist-item-signoff seams that already exist through the shared operator
surfaces.

Primary source material:

- [docs/architecture/phase-0-blueprint.md](./phase-0-blueprint.md)
- [docs/architecture/replay-model.md](./replay-model.md)
- [docs/architecture/web-console.md](./web-console.md)
- [docs/architecture/observability.md](./observability.md)
- [docs/architecture/extension-model.md](./extension-model.md)
- [docs/architecture/phase-28-handoff.md](./phase-28-handoff.md)
- [docs/architecture/phase-27-handoff.md](./phase-27-handoff.md)
- [docs/architecture/adr-0028-cross-run-audit-catalog-checklist-item-sign-offs-and-sign-off-notes.md](./adr-0028-cross-run-audit-catalog-checklist-item-sign-offs-and-sign-off-notes.md)
- [docs/architecture/adr-0027-cross-run-audit-catalog-checklist-item-acknowledgments-and-acknowledgment-notes.md](./adr-0027-cross-run-audit-catalog-checklist-item-acknowledgments-and-acknowledgment-notes.md)
- [docs/guides/audit-catalog-checklist-item-sign-offs.md](../guides/audit-catalog-checklist-item-sign-offs.md)
- [docs/guides/audit-catalog-checklist-item-acknowledgments.md](../guides/audit-catalog-checklist-item-acknowledgments.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 28 closed the gap where acknowledged attested evidenced verified
resolved blocked progressed assigned reviewed presets could carry thin
per-item sign-off state and a single sign-off note through package-owned
seams. The next repository-owned gap is still smaller than approval products,
workflow gating, payload persistence, copied artifact persistence,
attachment-upload products, artifact-vault workflows, threaded collaboration,
broader checklist orchestration, broader review workflow engines,
fine-grained RBAC, multi-tenant access, dashboards, search, or analytics
products: those same signed-off acknowledged presets still do not carry a
stable, package-owned way to record that a designated operator has marked an
explicit exception against the current sign-off, acknowledgment, attestation,
and supporting evidence set without turning that exception into replay,
approval, or workflow source of truth.

The smallest next step is to add a shared checklist-item-exception layer over
the existing checklist-item-signoff and checklist-item-acknowledgment paths.
This closes a thin exception gap without jumping into approval products,
workflow gating, payload persistence, binary artifact storage, artifact-vault
behavior, attachment-upload products, threaded collaboration, broader
orchestration, permission framework, dashboards, search products, or
analytics suites.

## Formal Name

- Primary name: `Cross-Run Audit Catalog Checklist Item Exceptions and Exception Notes`
- Short label: `Checklist Item Exceptions`

This is the suggested freeze name for Phase 29. If this document is merged, it
becomes the repository-owned formal Phase 29 name.

## Formal Goals

1. Add a shared audit-catalog checklist-item-exception contract that lets
   existing signed-off acknowledged attested evidenced verified resolved
   blocked progressed assigned reviewed presets carry stable per-item
   exception state and a thin exception note through package-owned records,
   without snapshotting audit facts or redefining replay and approval source
   of truth.
2. Expose the minimum record-exception, list-excepted, inspect-exception,
   clear-exception, and apply paths needed for SDK, API, CLI, and web
   surfaces to reopen exception metadata for signed-off acknowledged attested
   evidenced verified resolved blocked progressed assigned reviewed presets
   through the existing seams rather than app-owned storage reads or writes.
3. Allow inline and queued execution paths to participate in the same
   checklist-item-exception rules without introducing a second runtime model,
   workflow-correctness layer, approval framework, broader checklist
   orchestration engine, dashboard, or search engine.
4. Provide the minimum local-development and CI guidance needed to validate
   the shared checklist-item-exception contract and thin operator-facing
   exception-note surfaces.
5. Document the observability, dashboard, analytics, search, approval-
   product, workflow-gating, payload-persistence, artifact-storage, threaded
   collaboration, broader workflow, RBAC, multi-tenant, and broader platform
   work that remains deferred beyond Phase 29.

## Formal Acceptance Standards

1. A shared audit-catalog checklist-item-exception contract exists in packages
   and remains a derived layer over existing checklist-item-signoff,
   checklist-item-acknowledgment, checklist-item-attestation,
   checklist-item-evidence, checklist-item-verification,
   checklist-item-resolution, checklist-item-blocker,
   checklist-item-progress, assignment-checklist, review-assignment,
   review-signal, catalog-visibility, catalog, saved-view, navigation,
   drilldown, and run-scoped audit reads.
2. Operators can add or update thin per-item exception state and an optional
   exception note on a visible signed-off acknowledged attested evidenced
   verified resolved blocked progressed assigned reviewed preset, list entries
   carrying exception metadata, inspect exception metadata, clear exception
   metadata, and apply visible excepted presets through stable references
   rather than surface-local state.
3. Existing operator surfaces can query or present those exception paths
   through existing seams without introducing app-owned storage reads, direct
   writes, or a new orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. Exception metadata stores only stable per-item exception state, minimal
   actor and scope references, an optional thin exception note, and existing
   checklist-item-signoff, checklist-item-acknowledgment,
   checklist-item-attestation, checklist-item-evidence,
   checklist-item-verification, checklist-item-resolution,
   checklist-item-blocker, checklist-item-progress, assignment-checklist,
   review-assignment, review-signal, and catalog references rather than
   provider-specific payloads, copied binary artifacts, workflow-state
   snapshots, or replay-derived correctness facts.
6. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the checklist-item-exception path.
7. Local-development and CI guidance exists for the Phase 29 path.
8. Phase 29 naming is consistent across changed docs.
9. The phase does not introduce Phase 30 scope, a full observability backend,
   a productized dashboard, an approval product, a workflow-gating
   subsystem, an artifact-vault product, or an open-ended search and
   analytics product.

## Formal Non-Goals

Phase 29 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, discovery portals, or
   open-ended search products.
3. Replacing replay with a checklist-item-exception model or redefining
   additive audit facts as workflow-state source of truth.
4. Persisting every provider-specific tool payload, copied binary artifact, or
   full audit fact snapshot by default.
5. Fine-grained RBAC beyond basic operator and admin role expectations.
6. Threaded comments, broader review workflow engines, broader checklist
   orchestration, or broader multi-user curation features around audit
   catalogs.
7. Multi-tenant SaaS catalog concerns, organization directories, billing, or
   broader hosted control-plane product work.
8. Exception-driven approval products, workflow gating, attachment-upload
   products, artifact-vault products, or new workflow templates.
9. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
10. Plugin, marketplace, or ecosystem packaging work.
11. Phase 30 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/persistence`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin checklist-item-exception and exception-note
  presentation and excepted-preset application through existing API seams
- `packages/config` only if minimal exception defaults need documentation or
  exposure
- docs and minimal local-development configuration

Optional thin-touch areas only if implementation requires them:

- `packages/observability`
- `packages/events`
- `apps/worker`

Default non-targets:

- new templates
- product-surface redesign
- unrelated runtime, queue, or persistence refactors
- broad observability backend vendor integrations
- provider-payload persistence
- copied binary artifact storage infrastructure
- artifact-vault or attachment-upload infrastructure
- approval-product or workflow-gating infrastructure

## Preconditions

1. Phases 2 through 28 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, cross-run audit query
   baseline, identifier-driven drilldown baseline, linked audit navigation
   baseline, saved-view baseline, catalog baseline, catalog-visibility
   baseline, catalog-review-signal baseline, catalog-review-assignment
   baseline, assignment-checklist baseline, checklist-item-progress baseline,
   checklist-item-blocker baseline, checklist-item-resolution baseline,
   checklist-item-verification baseline, checklist-item-evidence baseline,
   checklist-item-attestation baseline, checklist-item-acknowledgment
   baseline, and checklist-item-signoff baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support checklist item exceptions without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning checklist item exceptions into a second source of
   truth for replay or approval semantics.
2. Making additive exception state or exception notes look required for
   workflow correctness rather than operator-facing audit context.
3. Expanding an exception phase into an approval product, workflow-gating
   subsystem, artifact vault, attachment-upload product, collaborative
   product, dashboard, analytics suite, search product, or permission
   platform effort.
4. Coupling the shared exception contract too tightly to URL structure,
   storage layout, or provider-specific artifact formats instead of keeping it
   as a stable read-model boundary.
5. Letting minimal exception metadata pull in premature collaboration, RBAC,
   org-directory, multi-tenant, binary-upload, or workflow-gating product
   scope.

## Must Be Deferred

The following remain out of scope for Phase 29:

1. Phase 30 or later product and platform expansion.
2. Full metrics backends, log-shipping stacks, alerting, and SLO platforms.
3. Productized observability dashboards, broad analytics UX, discovery
   products, or open-ended search products.
4. Persisting every provider-specific tool payload, copied binary artifact, or
   every derived audit fact snapshot by default.
5. Hosted queue operations, worker sharding, autoscaling, and advanced
   scheduling.
6. Fine-grained RBAC, organization or team management, multi-tenant access
   models, or broader SaaS product concerns.
7. Threaded collaborative comments, broader review workflow engines, broader
   checklist orchestration, broader multi-user curation, approval products,
   workflow-gating systems, artifact-vault workflows, or attachment-upload
   products beyond the minimum checklist-item-exception path for this phase.
8. Plugin, marketplace, or broader ecosystem packaging work.
9. Broad event-model redesign beyond the additional derived
   checklist-item-exception contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-29-checklist-item-exceptions`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the checklist-item-exception boundary
2. shared catalog checklist-item-exception contract
3. persistence and thin API, CLI, SDK, and web exception wiring
4. integration coverage for inline and queued exception reads and writes
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the exception persistence seam must land independently of the
  thin operator-facing exception-note surfaces.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 28

Phase 28 established a shared way to attach thin per-item sign-off state and
a single sign-off note to an acknowledged attested evidenced verified resolved
blocked progressed assigned reviewed preset. Phase 29 builds on that
foundation by adding a package-owned way to record thin per-item exception
state and a single exception note over that same signed-off preset while
preserving the same source-of-truth boundary and keeping operator surfaces
thin.

## Why This Is Phase 29

Once signed-off acknowledged attested evidenced verified resolved blocked
progressed assigned reviewed presets can carry per-item sign-off state and a
single sign-off note, the next repository-owned gap is not an approval
product, workflow-gating subsystem, payload persistence, a copied binary
artifact store, an artifact-vault product, a threaded collaboration product,
a broader checklist orchestration engine, a broader review workflow engine, a
fine-grained RBAC system, or a multi-tenant control plane. It is the lack of
a shared, package-owned way to record that a designated operator has marked a
thin exception against the current signed-off acknowledgment, attestation, and
supporting evidence set for that checklist item without defaulting to approval
products, workflow gating, payload persistence, or broader product scope. A
thin exception layer closes that smaller gap before approval products,
workflow gating, payload persistence, artifact storage, broader
orchestration, threaded collaboration, RBAC, SaaS, dashboards, search, or
platform concerns that the repository still defers beyond this phase.

## Start Gate Before Phase 29 Execution

Before Phase 29 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 29 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 30 scope.
6. The execution plan does not require approval-product semantics, workflow-
   gating semantics, provider-payload persistence, copied binary artifact
   storage, artifact-vault behavior, or attachment-upload surfaces.

## README Sync Decision

README is not a Phase 29 scope-freeze blocker.

The current repository-owned gap is the absence of a formal Phase 29
contract, not a top-level entrypoint mismatch introduced by this handoff.
This freeze does not change the repository positioning, install path, or
top-level user entrypoint. Because of that, README should stay out of scope
unless a later review proves the top-level entrypoint text is materially
misleading after the Phase 29 contract is merged.
