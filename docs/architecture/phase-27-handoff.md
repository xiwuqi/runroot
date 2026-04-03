# Phase 27: Cross-Run Audit Catalog Checklist Item Acknowledgments and Acknowledgment Notes

Status: repository-owned phase contract after scope freeze

This document records the repository-owned suggested execution contract for
Phase 27. It defines the minimum implementation boundary for a shared catalog
checklist-item-acknowledgment layer over the existing saved-view, navigation,
drilldown, run-scoped audit, catalog, catalog-visibility, catalog-review-
signal, catalog-review-assignment, assignment-checklist, checklist-item-
progress, checklist-item-blocker, checklist-item-resolution,
checklist-item-verification, checklist-item-evidence, and
checklist-item-attestation seams that already exist through the shared
operator surfaces.

Primary source material:

- [docs/architecture/phase-0-blueprint.md](./phase-0-blueprint.md)
- [docs/architecture/replay-model.md](./replay-model.md)
- [docs/architecture/web-console.md](./web-console.md)
- [docs/architecture/observability.md](./observability.md)
- [docs/architecture/extension-model.md](./extension-model.md)
- [docs/architecture/adr-0004-event-model-and-replay-source-of-truth.md](./adr-0004-event-model-and-replay-source-of-truth.md)
- [docs/architecture/adr-0008-web-console-and-observability-boundaries.md](./adr-0008-web-console-and-observability-boundaries.md)
- [docs/architecture/adr-0011-correlated-audit-projections-and-operator-views.md](./adr-0011-correlated-audit-projections-and-operator-views.md)
- [docs/architecture/adr-0012-cross-run-audit-queries-and-filters.md](./adr-0012-cross-run-audit-queries-and-filters.md)
- [docs/architecture/adr-0013-cross-run-audit-drilldowns-and-identifier-queries.md](./adr-0013-cross-run-audit-drilldowns-and-identifier-queries.md)
- [docs/architecture/adr-0014-cross-run-audit-navigation-and-linked-operator-views.md](./adr-0014-cross-run-audit-navigation-and-linked-operator-views.md)
- [docs/architecture/adr-0015-cross-run-audit-saved-views-and-operator-presets.md](./adr-0015-cross-run-audit-saved-views-and-operator-presets.md)
- [docs/architecture/adr-0016-cross-run-audit-view-catalogs-and-curated-operator-presets.md](./adr-0016-cross-run-audit-view-catalogs-and-curated-operator-presets.md)
- [docs/architecture/adr-0017-cross-run-audit-catalog-visibility-and-shared-presets.md](./adr-0017-cross-run-audit-catalog-visibility-and-shared-presets.md)
- [docs/architecture/adr-0018-cross-run-audit-catalog-review-signals-and-shared-notes.md](./adr-0018-cross-run-audit-catalog-review-signals-and-shared-notes.md)
- [docs/architecture/adr-0019-cross-run-audit-catalog-review-assignments-and-operator-handoffs.md](./adr-0019-cross-run-audit-catalog-review-assignments-and-operator-handoffs.md)
- [docs/architecture/adr-0020-cross-run-audit-catalog-assignment-checklists-and-handoff-statuses.md](./adr-0020-cross-run-audit-catalog-assignment-checklists-and-handoff-statuses.md)
- [docs/architecture/adr-0021-cross-run-audit-catalog-checklist-item-progress-and-completion-notes.md](./adr-0021-cross-run-audit-catalog-checklist-item-progress-and-completion-notes.md)
- [docs/architecture/adr-0022-cross-run-audit-catalog-checklist-item-blockers-and-blocker-notes.md](./adr-0022-cross-run-audit-catalog-checklist-item-blockers-and-blocker-notes.md)
- [docs/architecture/adr-0023-cross-run-audit-catalog-checklist-item-resolutions-and-resolution-notes.md](./adr-0023-cross-run-audit-catalog-checklist-item-resolutions-and-resolution-notes.md)
- [docs/architecture/adr-0024-cross-run-audit-catalog-checklist-item-verifications-and-verification-notes.md](./adr-0024-cross-run-audit-catalog-checklist-item-verifications-and-verification-notes.md)
- [docs/architecture/adr-0025-cross-run-audit-catalog-checklist-item-evidence-references-and-evidence-notes.md](./adr-0025-cross-run-audit-catalog-checklist-item-evidence-references-and-evidence-notes.md)
- [docs/architecture/adr-0026-cross-run-audit-catalog-checklist-item-attestations-and-attestation-notes.md](./adr-0026-cross-run-audit-catalog-checklist-item-attestations-and-attestation-notes.md)
- [docs/architecture/phase-26-handoff.md](./phase-26-handoff.md)
- [docs/guides/audit-view-catalogs.md](../guides/audit-view-catalogs.md)
- [docs/guides/audit-catalog-visibility.md](../guides/audit-catalog-visibility.md)
- [docs/guides/audit-catalog-review-signals.md](../guides/audit-catalog-review-signals.md)
- [docs/guides/audit-catalog-review-assignments.md](../guides/audit-catalog-review-assignments.md)
- [docs/guides/audit-catalog-assignment-checklists.md](../guides/audit-catalog-assignment-checklists.md)
- [docs/guides/audit-catalog-checklist-item-progress.md](../guides/audit-catalog-checklist-item-progress.md)
- [docs/guides/audit-catalog-checklist-item-blockers.md](../guides/audit-catalog-checklist-item-blockers.md)
- [docs/guides/audit-catalog-checklist-item-resolutions.md](../guides/audit-catalog-checklist-item-resolutions.md)
- [docs/guides/audit-catalog-checklist-item-verifications.md](../guides/audit-catalog-checklist-item-verifications.md)
- [docs/guides/audit-catalog-checklist-item-evidence.md](../guides/audit-catalog-checklist-item-evidence.md)
- [docs/guides/audit-catalog-checklist-item-attestations.md](../guides/audit-catalog-checklist-item-attestations.md)
- [docs/guides/observability.md](../guides/observability.md)
- [docs/roadmap.md](../roadmap.md)
- [README.md](../../README.md)

## Why Now

Phase 26 closed the gap where evidenced verified resolved blocked progressed
assigned reviewed presets could carry thin per-item attestation state and a
single attestation note through package-owned seams. The next repository-owned
gap is still smaller than approval gating, payload persistence, copied
artifact persistence, attachment-upload products, artifact-vault workflows,
threaded collaboration, broader checklist orchestration, broader review
workflow engines, fine-grained RBAC, multi-tenant access, dashboards, search,
or analytics products: those same attested evidenced presets still do not
carry a stable, package-owned way to record that a downstream operator has
acknowledged the current attestation and supporting evidence set without
turning that acknowledgment into replay, approval, or workflow source of
truth.

The smallest next step is to add a shared checklist-item-acknowledgment layer
over the existing checklist-item-attestation and checklist-item-evidence
paths. This closes a thin acknowledgment gap without jumping into approval
gating, payload persistence, binary artifact storage, artifact-vault
behavior, attachment-upload products, threaded collaboration, broader
orchestration, permission framework, dashboard, search product, or analytics
suite.

## Formal Name

- Primary name: `Cross-Run Audit Catalog Checklist Item Acknowledgments and Acknowledgment Notes`
- Short label: `Checklist Item Acknowledgments`

This is the suggested freeze name for Phase 27. If this document is merged, it
becomes the repository-owned formal Phase 27 name.

## Formal Goals

1. Add a shared audit-catalog checklist-item-acknowledgment contract that lets
   existing attested evidenced verified resolved blocked progressed assigned
   reviewed presets carry stable per-item acknowledgment state and a thin
   acknowledgment note through package-owned records, without snapshotting
   audit facts or redefining replay and approval source of truth.
2. Expose the minimum acknowledge, list-acknowledged,
   inspect-acknowledgment, clear-acknowledgment, and apply paths needed for
   SDK, API, CLI, and web surfaces to reopen acknowledgment metadata for
   attested evidenced verified resolved blocked progressed assigned reviewed
   presets through the existing seams rather than app-owned storage reads or
   writes.
3. Allow inline and queued execution paths to participate in the same
   checklist-item-acknowledgment rules without introducing a second runtime
   model, workflow-correctness layer, approval framework, broader checklist
   orchestration engine, dashboard, or search engine.
4. Provide the minimum local-development and CI guidance needed to validate
   the shared checklist-item-acknowledgment contract and thin operator-facing
   acknowledgment-note surfaces.
5. Document the observability, dashboard, analytics, search, approval-
   product, payload-persistence, artifact-storage, threaded collaboration,
   broader workflow, RBAC, multi-tenant, and broader platform work that
   remains deferred beyond Phase 27.

## Formal Acceptance Standards

1. A shared audit-catalog checklist-item-acknowledgment contract exists in
   packages and remains a derived layer over existing checklist-item-
   attestation, checklist-item-evidence, checklist-item-verification,
   checklist-item-resolution, checklist-item-blocker,
   checklist-item-progress, assignment-checklist, review-assignment,
   review-signal, catalog-visibility, catalog, saved-view, navigation,
   drilldown, and run-scoped audit reads.
2. Operators can add or update thin per-item acknowledgment state and an
   optional acknowledgment note on a visible attested evidenced verified
   resolved blocked progressed assigned reviewed preset, list entries carrying
   acknowledgment metadata, inspect acknowledgment metadata, clear
   acknowledgment metadata, and apply visible acknowledged presets through
   stable references rather than surface-local state.
3. Existing operator surfaces can query or present those acknowledgment paths
   through existing seams without introducing app-owned storage reads, direct
   writes, or a new orchestration stack.
4. Replay and approval semantics still derive only from persisted runtime and
   approval events.
5. Acknowledgment metadata stores only stable per-item acknowledgment state,
   minimal actor and scope references, an optional thin acknowledgment note,
   and existing checklist-item-attestation, checklist-item-evidence,
   checklist-item-verification, checklist-item-resolution,
   checklist-item-blocker, checklist-item-progress, assignment-checklist,
   review-assignment, review-signal, and catalog references rather than
   provider-specific payloads, copied binary artifacts, workflow-state
   snapshots, or replay-derived correctness facts.
6. At least one inline-originated run and one queued-originated run appear in
   integration coverage for the checklist-item-acknowledgment path.
7. Local-development and CI guidance exists for the Phase 27 path.
8. Phase 27 naming is consistent across changed docs.
9. `pnpm lint` passes.
10. `pnpm typecheck` passes.
11. `pnpm test` passes.
12. `pnpm test:integration` passes.
13. `pnpm build` passes.
14. The phase does not introduce Phase 28 scope, a full observability
    backend, a productized dashboard, an approval product, an artifact-vault
    product, or an open-ended search and analytics product.

## Formal Non-Goals

Phase 27 does not include:

1. Full observability backend integration, log shipping, metrics, alerting, or
   SLO platforms.
2. Productized dashboards, broad analytics UX, discovery portals, or
   open-ended search products.
3. Replacing replay with a checklist-item-acknowledgment model or redefining
   additive audit facts as workflow-state source of truth.
4. Persisting every provider-specific tool payload, copied binary artifact, or
   full audit fact snapshot by default.
5. Fine-grained RBAC beyond basic operator and admin role expectations.
6. Threaded comments, broader review workflow engines, broader checklist
   orchestration, or broader multi-user curation features around audit
   catalogs.
7. Multi-tenant SaaS catalog concerns, organization directories, billing, or
   broader hosted control-plane product work.
8. Acknowledgment-driven approval gating, workflow orchestration, attachment-
   upload products, artifact-vault products, or new workflow templates.
9. Worker sharding, autoscaling, hosted queue operations, or broader
   deployment-platform work.
10. Plugin, marketplace, or ecosystem packaging work.
11. Phase 28 or later expansion.

## Recommended Monorepo Impact Range

Primary areas:

- `packages/replay`
- `packages/persistence`
- `packages/sdk`
- `apps/api`
- `packages/cli`
- `apps/web` only for thin checklist-item-acknowledgment and acknowledgment-
  note presentation and acknowledged-preset application through existing API
  seams
- `packages/config` only if minimal acknowledgment defaults need
  documentation or exposure
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
- approval-gating or workflow-engine infrastructure

## Preconditions

1. Phases 2 through 26 are merged into `main`.
2. There are no stacked PR dependencies.
3. The database-backed persistence baseline, queued execution path, persisted
   tool-history path, run-scoped correlated audit view, cross-run audit query
   baseline, identifier-driven drilldown baseline, linked audit navigation
   baseline, saved-view baseline, catalog baseline, catalog-visibility
   baseline, catalog-review-signal baseline, catalog-review-assignment
   baseline, assignment-checklist baseline, checklist-item-progress baseline,
   checklist-item-blocker baseline, checklist-item-resolution baseline,
   checklist-item-verification baseline, checklist-item-evidence baseline, and
   checklist-item-attestation baseline are in place and stable.
4. Baseline quality commands are runnable.
5. Replay, audit, observability, and operator seams are stable enough to
   support checklist item acknowledgments without semantic rework.

At suggested freeze time, these preconditions are satisfied.

## Primary Architecture Risks

1. Accidentally turning checklist item acknowledgments into a second source of
   truth for replay or approval semantics.
2. Making additive acknowledgment state or acknowledgment notes look required
   for workflow correctness rather than operator-facing audit context.
3. Expanding an acknowledgment phase into an approval product, artifact vault,
   attachment-upload product, collaborative product, dashboard, analytics
   suite, search product, or permission platform effort.
4. Coupling the shared acknowledgment contract too tightly to URL structure,
   storage layout, or provider-specific artifact formats instead of keeping it
   as a stable read-model boundary.
5. Letting minimal acknowledgment metadata pull in premature collaboration,
   RBAC, org-directory, multi-tenant, binary-upload, or workflow-gating
   product scope.

## Must Be Deferred

The following remain out of scope for Phase 27:

1. Phase 28 or later product and platform expansion.
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
   artifact-vault workflows, or attachment-upload products beyond the minimum
   checklist-item-acknowledgment path for this phase.
8. Plugin, marketplace, or broader ecosystem packaging work.
9. Broad event-model redesign beyond the additional derived checklist-item-
   acknowledgment contract.

## Recommended Branch Name Slug

Use:

- `wuxi/phase-27-checklist-item-acknowledgments`

## Recommended Commit Slicing

Recommended split:

1. docs and ADR alignment for the checklist-item-acknowledgment boundary
2. shared catalog checklist-item-acknowledgment contract
3. persistence and thin API, CLI, SDK, and web acknowledgment wiring
4. integration coverage for inline and queued acknowledgment reads and writes
5. docs polish and deferred-work updates

## Recommended PR Strategy

- Open a direct-to-main PR from the latest `main`.
- Prefer one primary PR if the scope stays narrow.
- Split only if the acknowledgment persistence seam must land independently of
  the thin operator-facing acknowledgment-note surfaces.
- Do not use stacked PRs unless a new blocker appears and the reason is
  documented.

## Relationship To Phase 26

Phase 26 established a shared way to attach thin per-item attestation state
and a single attestation note to an evidenced verified resolved blocked
progressed assigned reviewed preset. Phase 27 builds on that foundation by
adding a package-owned way to record thin per-item acknowledgment state and a
single acknowledgment note over that same attested preset while preserving the
same source-of-truth boundary and keeping operator surfaces thin.

## Why This Is Phase 27

Once attested evidenced verified resolved blocked progressed assigned reviewed
presets can carry per-item attestation state and a single attestation note,
the next repository-owned gap is not an approval product, payload
persistence, a copied binary artifact store, an artifact-vault product, a
threaded collaboration product, a broader checklist orchestration engine, a
broader review workflow engine, a fine-grained RBAC system, or a multi-tenant
control plane. It is the lack of a shared, package-owned way to record that a
downstream operator has acknowledged the current attestation and supporting
evidence set for that checklist item without defaulting to approval gating,
payload persistence, or broader product scope. A thin acknowledgment layer
closes that smaller gap before approval products, payload persistence,
artifact storage, broader orchestration, threaded collaboration, RBAC, SaaS,
dashboard, search, or platform concerns that the repository still defers
beyond this phase.

## Start Gate Before Phase 27 Execution

Before Phase 27 implementation begins, verify all of the following:

1. `main` is synced to `origin/main`.
2. There are no open stacked PR dependencies.
3. The working tree is clean.
4. Phase 27 naming is consistent in `AGENTS.md`, `docs/roadmap.md`, and this
   handoff.
5. The implementation plan still fits the non-goals and does not expand into
   Phase 28 scope.
6. The execution plan does not require approval-gating semantics, provider-
   payload persistence, copied binary artifact storage, artifact-vault
   behavior, or attachment-upload surfaces.

## README Sync Decision

README is not a Phase 27 scope-freeze blocker.

The current repository-owned gap is the absence of a formal Phase 27
contract, not a top-level entrypoint mismatch introduced by this handoff.
This freeze does not change the repository positioning, install path, or top-
level user entrypoint. Because of that, README should stay out of scope
unless a later review proves the top-level entrypoint text is materially
misleading after the Phase 27 contract is merged.
