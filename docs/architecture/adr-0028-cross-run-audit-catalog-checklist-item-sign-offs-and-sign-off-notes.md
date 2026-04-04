# ADR-0028: Cross-Run Audit Catalog Checklist Item Sign-Offs and Sign-Off Notes

Date: 2026-04-04

## Status

Accepted on branch for Phase 28 implementation.

## Context

Phase 27 added a thin checklist-item-acknowledgment layer over attested
evidenced verified resolved blocked progressed assigned reviewed audit catalog
entries. Operators could record that the current attestation and supporting
evidence set had been acknowledged, but there was still no package-owned way
to capture that a downstream operator had signed off the current
acknowledgment, attestation, and evidence set without expanding into approval
gating, workflow orchestration, artifact-vault behavior, attachment-upload
products, provider-payload persistence, copied artifact persistence, or a
broader collaboration system.

The next repository-owned gap is still narrower than threaded collaboration,
broader checklist orchestration, broader review workflow engines,
fine-grained RBAC, multi-tenant access, dashboards, search, analytics,
approval products, or attachment-upload products. Runroot needs a stable
checklist-item-signoff layer that remains derived over the existing
checklist-item-acknowledgment, checklist-item-attestation,
checklist-item-evidence, checklist-item-verification,
checklist-item-resolution, checklist-item-blocker,
checklist-item-progress, assignment-checklist, review-assignment,
review-signal, visibility, catalog, and saved-view seams.

## Decision

Runroot adds a shared audit-catalog checklist-item-signoff contract
with the following properties:

- checklist item sign-offs remain additive operator metadata
- checklist item sign-offs reference existing catalog entries,
  checklist-item-acknowledgments, checklist-item-attestations,
  checklist-item-evidence, checklist-item-verifications,
  checklist-item-resolutions, checklist-item-blockers,
  checklist-item-progress, assignment checklists, review assignments, and
  review signals
- checklist item sign-offs store only stable per-item sign-off state, a thin
  optional sign-off note, minimal actor and scope references, and existing
  catalog refs
- checklist item sign-offs do not snapshot audit facts, provider
  payloads, copied artifacts, or workflow state
- checklist item sign-offs do not change replay or approval source of
  truth
- applying a signed-off preset reuses the existing catalog-apply path

The shared sign-off seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Sign-Off visibility stays minimal:

- list and inspect are scoped to operators already involved in the
  acknowledgment, attestation, evidence, verification, resolution, blocker,
  progress, and assignment handoff path
- sign-off entries can only reference checklist items that already exist in
  the shared checklist-item-acknowledgment layer
- sign-off state stays as a thin per-item enum
- sign-off notes stay as a single thin string
- no threaded comments, checklist workflow engine, approval-gating product,
  permission framework, organization directory, multi-tenant surface,
  attachment-upload product, or artifact vault is added

## Consequences

### Positive

- attested evidenced verified resolved blocked progressed assigned reviewed
  presets can carry thin per-item sign-off state and a single sign-off note
  through shared package-owned seams
- inline and queued runs reuse the same checklist-item-signoff contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- checklist item sign-offs are still a derived layer that depends on
  checklist-item acknowledgment, checklist-item attestation,
  checklist-item evidence, checklist-item verifications,
  checklist-item resolutions, checklist-item blockers,
  checklist-item progress, assignment checklists, assignments, review
  signals, visibility, and catalog integrity
- sign-offs intentionally stay shallow and do not solve approval
  products, workflow gating, broader checklist orchestration, threaded
  collaboration, payload persistence, binary artifact persistence, RBAC, or
  multi-tenant requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- broader review workflow engines
- broader checklist orchestration
- sign-off-driven approval gating
- attachment-upload or artifact-vault products
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- broader collaboration beyond thin operator-facing sign-off metadata
- provider payload, copied artifact, or full snapshot persistence
