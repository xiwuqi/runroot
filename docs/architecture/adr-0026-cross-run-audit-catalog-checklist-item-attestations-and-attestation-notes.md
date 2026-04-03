# ADR-0026: Cross-Run Audit Catalog Checklist Item Attestations and Attestation Notes

Date: 2026-04-02

## Status

Accepted on branch for Phase 26 implementation.

## Context

Phase 25 added a thin checklist-item-evidence layer over verified resolved
blocked progressed assigned reviewed audit catalog entries. Operators could
attach stable evidence references and a single evidence note through shared
SDK, API, CLI, and web seams, but there was still no package-owned way to
record whether that evidence had been affirmatively attested without expanding
into payload persistence, copied artifact persistence, attachment-upload, an
artifact-vault product, or approval gating.

The next repository-owned gap is still narrower than threaded collaboration,
broader checklist orchestration, broader review workflow engines,
fine-grained RBAC, multi-tenant access, dashboards, search, analytics, or
artifact-upload products. Runroot needs a stable checklist-item-attestation
layer that remains derived over the existing checklist-item-evidence,
checklist-item-verification, checklist-item-resolution,
checklist-item-blocker, checklist-item-progress, assignment-checklist,
review-assignment, review-signal, visibility, catalog, and saved-view seams.

## Decision

Runroot adds a shared audit-catalog checklist-item-attestation contract with
the following properties:

- checklist item attestations remain additive operator metadata
- checklist item attestations reference existing catalog entries,
  checklist-item-evidence, checklist-item-verifications,
  checklist-item-resolutions, checklist-item-blockers,
  checklist-item-progress, assignment checklists, review assignments, and
  review signals
- checklist item attestations store only stable per-item attestation state, a
  thin optional attestation note, minimal actor and scope references, and
  existing catalog refs
- checklist item attestations do not snapshot audit facts, provider payloads,
  copied artifacts, or workflow state
- checklist item attestations do not change replay or approval source of truth
- applying an attested preset reuses the existing catalog-apply path

The shared attestation seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Attestation visibility stays minimal:

- list and inspect are scoped to operators already involved in the evidence,
  verification, resolution, blocker, progress, and assignment handoff path
- attestation entries can only reference checklist items that already exist in
  the shared checklist-item-evidence layer
- attestation state stays as a thin per-item enum
- attestation notes stay as a single thin string
- no threaded comments, checklist workflow engine, permission framework,
  organization directory, multi-tenant surface, attachment-upload product, or
  artifact vault is added

## Consequences

### Positive

- evidenced verified resolved blocked progressed assigned reviewed presets can
  carry thin per-item attestation state and a single attestation note through
  shared package-owned seams
- inline and queued runs reuse the same checklist-item-attestation contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- checklist item attestations are still a derived layer that depends on
  checklist-item evidence, checklist-item verifications, checklist-item
  resolutions, checklist-item blockers, checklist-item progress, assignment
  checklists, assignments, review signals, visibility, and catalog integrity
- attestations intentionally stay shallow and do not solve broader checklist
  orchestration, threaded collaboration, payload persistence, binary artifact
  persistence, RBAC, or multi-tenant requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- broader review workflow engines
- broader checklist orchestration
- attestation-driven approval gating
- attachment-upload or artifact-vault products
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- broader collaboration beyond thin operator-facing attestation metadata
- provider payload, copied artifact, or full snapshot persistence
