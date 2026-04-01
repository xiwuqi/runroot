# ADR-0024: Cross-Run Audit Catalog Checklist Item Verifications and Verification Notes

Date: 2026-04-01

## Status

Accepted on branch for Phase 24 implementation.

## Context

Phase 23 added a thin checklist-item-resolution layer over blocked progressed
assigned reviewed audit catalog entries. Operators could attach per-item
resolution state and a single resolution note through shared SDK, API, CLI, and
web seams, but there was still no package-owned way to record stable per-item
verification state or a thin verification note through those same seams.

The next repository-owned gap is still narrower than threaded collaboration,
broader checklist orchestration, broader review workflow engines,
fine-grained RBAC, multi-tenant access, dashboards, search, or analytics.
Runroot needs a stable checklist-item-verification layer that remains derived
over the existing checklist-item-resolution, checklist-item-blocker,
checklist-item-progress, assignment-checklist, review-assignment,
review-signal, visibility, catalog, and saved-view seams.

## Decision

Runroot adds a shared audit-catalog checklist-item-verification contract with
the following properties:

- checklist item verifications remain additive operator metadata
- checklist item verifications reference existing catalog entries,
  checklist-item-resolutions, checklist-item-blockers,
  checklist-item-progress, assignment checklists, review assignments, and
  review signals
- checklist item verifications store only stable per-item verification state, a
  thin optional verification note, minimal actor and scope references, and
  existing catalog refs
- checklist item verifications do not snapshot audit facts, provider payloads,
  or workflow state
- checklist item verifications do not change replay or approval source of truth
- applying a verified preset reuses the existing catalog-apply path

The shared verification seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Verification visibility stays minimal:

- list and inspect are scoped to operators already involved in the resolution,
  blocker, progress, and assignment handoff path
- verification entries can only reference checklist items that already exist in
  the shared checklist-item-resolution layer
- verification notes stay as a single thin string
- no threaded comments, checklist workflow engine, permission framework,
  organization directory, or multi-tenant surface is added

## Consequences

### Positive

- resolved blocked progressed assigned reviewed presets can carry thin per-item
  verification state and a single verification note through shared package-owned
  seams
- inline and queued runs reuse the same checklist-item-verification contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- checklist item verifications are still a derived layer that depends on
  checklist-item resolutions, checklist-item blockers, checklist-item progress,
  assignment checklists, assignments, review signals, visibility, and catalog
  integrity
- verifications intentionally stay shallow and do not solve broader checklist
  orchestration, threaded collaboration, RBAC, or multi-tenant requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- broader review workflow engines
- broader checklist orchestration
- verification-driven approval gating
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- broader collaboration beyond thin operator-facing verification metadata
