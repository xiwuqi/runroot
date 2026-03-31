# ADR-0022: Cross-Run Audit Catalog Checklist Item Blockers And Blocker Notes

Date: 2026-03-31

## Status

Accepted on branch for Phase 22 implementation.

## Context

Phase 21 added a thin checklist-item-progress layer over progressed assigned
reviewed audit catalog entries. Operators could attach per-item progress and a
single completion note through shared SDK, API, CLI, and web seams, but there
was still no package-owned way to record stable per-item blockers or a thin
blocker note through those same seams.

The next repository-owned gap is still narrower than threaded collaboration,
broader checklist orchestration, broader review workflow engines,
fine-grained RBAC, multi-tenant access, dashboards, search, or analytics.
Runroot needs a stable checklist-item-blocker layer that remains derived over
the existing checklist-item-progress, assignment-checklist, review-assignment,
review-signal, visibility, catalog, and saved-view seams.

## Decision

Runroot adds a shared audit-catalog checklist-item-blocker contract with the
following properties:

- checklist item blockers remain additive operator metadata
- checklist item blockers reference existing catalog entries, checklist-item
  progress, assignment checklists, review assignments, and review signals
- checklist item blockers store only stable per-item blocker state, a thin
  optional blocker note, minimal actor and scope references, and existing
  catalog references
- checklist item blockers do not snapshot audit facts, provider payloads, or
  workflow state
- checklist item blockers do not change replay or approval source of truth
- applying a blocked preset reuses the existing catalog-apply path

The shared blocker seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Blocker visibility stays minimal:

- list and inspect are scoped to operators already involved in the assignment
  and progress handoff
- blocker entries can only reference checklist items that already exist in the
  shared checklist-item-progress layer
- blocker notes stay as a single thin string
- no threaded comments, checklist workflow engine, permission framework,
  organization directory, or multi-tenant surface is added

## Consequences

### Positive

- progressed assigned reviewed presets can carry thin per-item blocker state
  and a single blocker note through shared package-owned seams
- inline and queued runs reuse the same checklist-item-blocker contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- checklist item blockers are still a derived layer that depends on
  checklist-item progress, assignment checklist, assignment, review-signal,
  visibility, and catalog integrity
- blockers intentionally stay shallow and do not solve broader checklist
  orchestration, threaded collaboration, RBAC, or multi-tenant requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- broader review workflow engines
- broader checklist orchestration
- blocker-driven approval gating
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- broader collaboration beyond thin operator-facing blocker metadata
