# ADR-0023: Cross-Run Audit Catalog Checklist Item Resolutions and Resolution Notes

Date: 2026-03-31

## Status

Accepted on branch for Phase 23 implementation.

## Context

Phase 22 added a thin checklist-item-blocker layer over progressed assigned
reviewed audit catalog entries. Operators could attach per-item blocker state
and a single blocker note through shared SDK, API, CLI, and web seams, but
there was still no package-owned way to record stable per-item resolutions or a
thin resolution note through those same seams.

The next repository-owned gap is still narrower than threaded collaboration,
broader checklist orchestration, broader review workflow engines,
fine-grained RBAC, multi-tenant access, dashboards, search, or analytics.
Runroot needs a stable checklist-item-resolution layer that remains derived over
the existing checklist-item-blocker, checklist-item-progress,
assignment-checklist, review-assignment, review-signal, visibility, catalog,
and saved-view seams.

## Decision

Runroot adds a shared audit-catalog checklist-item-resolution contract with the
following properties:

- checklist item resolutions remain additive operator metadata
- checklist item resolutions reference existing catalog entries,
  checklist-item-blockers, checklist-item progress, assignment checklists,
  review assignments, and review signals
- checklist item resolutions store only stable per-item resolution state, a thin
  optional resolution note, minimal actor and scope references, and existing
  catalog refs
- checklist item resolutions do not snapshot audit facts, provider payloads, or
  workflow state
- checklist item resolutions do not change replay or approval source of truth
- applying a resolved preset reuses the existing catalog-apply path

The shared resolution seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Resolution visibility stays minimal:

- list and inspect are scoped to operators already involved in the blocker,
  progress, and assignment handoff path
- resolution entries can only reference checklist items that already exist in
  the shared checklist-item-blocker layer
- resolution notes stay as a single thin string
- no threaded comments, checklist workflow engine, permission framework,
  organization directory, or multi-tenant surface is added

## Consequences

### Positive

- blocked progressed assigned reviewed presets can carry thin per-item
  resolution state and a single resolution note through shared package-owned
  seams
- inline and queued runs reuse the same checklist-item-resolution contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- checklist item resolutions are still a derived layer that depends on
  checklist-item blockers, checklist-item progress, assignment checklist,
  assignment, review-signal, visibility, and catalog integrity
- resolutions intentionally stay shallow and do not solve broader checklist
  orchestration, threaded collaboration, RBAC, or multi-tenant requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- broader review workflow engines
- broader checklist orchestration
- resolution-driven approval gating
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- broader collaboration beyond thin operator-facing resolution metadata
