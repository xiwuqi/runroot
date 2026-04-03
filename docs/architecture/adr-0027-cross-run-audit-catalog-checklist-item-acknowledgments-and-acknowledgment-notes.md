# ADR-0027: Cross-Run Audit Catalog Checklist Item Acknowledgments and Acknowledgment Notes

Date: 2026-04-03

## Status

Accepted on branch for Phase 27 implementation.

## Context

Phase 26 added a thin checklist-item-attestation layer over evidenced verified
resolved blocked progressed assigned reviewed audit catalog entries. Operators
could record whether stable evidence references had been attested, but there
was still no package-owned way to capture that a downstream operator had
acknowledged the current attestation and supporting evidence set without
expanding into approval gating, workflow orchestration, artifact-vault
behavior, attachment-upload products, provider-payload persistence, copied
artifact persistence, or a broader collaboration system.

The next repository-owned gap is still narrower than threaded collaboration,
broader checklist orchestration, broader review workflow engines,
fine-grained RBAC, multi-tenant access, dashboards, search, analytics,
approval products, or attachment-upload products. Runroot needs a stable
checklist-item-acknowledgment layer that remains derived over the existing
checklist-item-attestation, checklist-item-evidence,
checklist-item-verification, checklist-item-resolution,
checklist-item-blocker, checklist-item-progress, assignment-checklist,
review-assignment, review-signal, visibility, catalog, and saved-view seams.

## Decision

Runroot adds a shared audit-catalog checklist-item-acknowledgment contract
with the following properties:

- checklist item acknowledgments remain additive operator metadata
- checklist item acknowledgments reference existing catalog entries,
  checklist-item-attestations, checklist-item-evidence,
  checklist-item-verifications, checklist-item-resolutions,
  checklist-item-blockers, checklist-item-progress, assignment checklists,
  review assignments, and review signals
- checklist item acknowledgments store only stable per-item acknowledgment
  state, a thin optional acknowledgment note, minimal actor and scope
  references, and existing catalog refs
- checklist item acknowledgments do not snapshot audit facts, provider
  payloads, copied artifacts, or workflow state
- checklist item acknowledgments do not change replay or approval source of
  truth
- applying an acknowledged preset reuses the existing catalog-apply path

The shared acknowledgment seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Acknowledgment visibility stays minimal:

- list and inspect are scoped to operators already involved in the attestation,
  evidence, verification, resolution, blocker, progress, and assignment
  handoff path
- acknowledgment entries can only reference checklist items that already exist
  in the shared checklist-item-attestation layer
- acknowledgment state stays as a thin per-item enum
- acknowledgment notes stay as a single thin string
- no threaded comments, checklist workflow engine, approval-gating product,
  permission framework, organization directory, multi-tenant surface,
  attachment-upload product, or artifact vault is added

## Consequences

### Positive

- attested evidenced verified resolved blocked progressed assigned reviewed
  presets can carry thin per-item acknowledgment state and a single
  acknowledgment note through shared package-owned seams
- inline and queued runs reuse the same checklist-item-acknowledgment contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- checklist item acknowledgments are still a derived layer that depends on
  checklist-item attestation, checklist-item evidence, checklist-item
  verifications, checklist-item resolutions, checklist-item blockers,
  checklist-item progress, assignment checklists, assignments, review signals,
  visibility, and catalog integrity
- acknowledgments intentionally stay shallow and do not solve approval
  products, workflow gating, broader checklist orchestration, threaded
  collaboration, payload persistence, binary artifact persistence, RBAC, or
  multi-tenant requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- broader review workflow engines
- broader checklist orchestration
- acknowledgment-driven approval gating
- attachment-upload or artifact-vault products
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- broader collaboration beyond thin operator-facing acknowledgment metadata
- provider payload, copied artifact, or full snapshot persistence
