# ADR-0021: Cross-Run Audit Catalog Checklist Item Progress And Completion Notes

Date: 2026-03-31

## Status

Accepted on branch for Phase 21 implementation.

## Context

Phase 20 added a thin assignment-checklist layer over assigned reviewed audit
catalog entries. Operators could attach checklist items and a stable handoff
status through shared SDK, API, CLI, and web seams, but there was still no
package-owned way to record per-item progress or a single completion note
through those same seams.

The next repository-owned gap is narrower than threaded collaboration,
broader review workflow engines, fine-grained RBAC, multi-tenant access,
dashboards, search, or analytics. Runroot needs a stable checklist-item-
progress layer that remains derived over the existing assignment-checklist,
review-assignment, review-signal, visibility, catalog, and saved-view seams.

## Decision

Runroot adds a shared audit-catalog checklist-item-progress contract with the
following properties:

- checklist item progress remains additive operator metadata
- checklist item progress references existing catalog entries, assignment
  checklists, review assignments, and review signals
- checklist item progress stores only stable per-item progress state, a thin
  optional completion note, minimal actor and scope references, and existing
  catalog references
- checklist item progress does not snapshot audit facts, provider payloads, or
  workflow state
- checklist item progress does not change replay or approval source of truth
- applying a progressed preset reuses the existing catalog-apply path

The shared progress seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Progress visibility stays minimal:

- list and inspect are scoped to operators already involved in the assignment
  handoff
- progress entries can only reference checklist items that already exist in
  the shared assignment-checklist layer
- completion notes stay as a single thin string
- no threaded comments, checklist workflow engine, permission framework,
  organization directory, or multi-tenant surface is added

## Consequences

### Positive

- assigned reviewed presets can carry thin per-item checklist progress and a
  single completion note through shared package-owned seams
- inline and queued runs reuse the same checklist-item-progress contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- checklist item progress is still a derived layer that depends on assignment
  checklist, assignment, review-signal, visibility, and catalog integrity
- progress intentionally stays shallow and does not solve broader checklist
  orchestration, threaded collaboration, RBAC, or multi-tenant requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- broader review workflow engines
- broader checklist orchestration
- checklist-item-driven approval gating
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- broader collaboration beyond thin operator-facing progress metadata
