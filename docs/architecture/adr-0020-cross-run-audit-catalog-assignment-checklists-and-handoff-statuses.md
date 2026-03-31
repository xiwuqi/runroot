# ADR-0020: Cross-Run Audit Catalog Assignment Checklists And Handoff Statuses

Date: 2026-03-30

## Status

Accepted on branch for Phase 20 implementation.

## Context

Phase 19 added a thin review-assignment layer over reviewed visible audit
catalog entries. Operators could hand a reviewed preset to a specific operator
through stable assignment metadata and an optional handoff note, but there was
still no package-owned way to attach thin checklist items and a stable handoff
status to that assignment through the same SDK, API, CLI, and web seams.

The next gap is narrower than threaded collaboration, review workflow engines,
fine-grained RBAC, multi-tenant access, dashboards, search, or analytics. The
repository needs a stable assignment-checklist layer that remains derived over
the existing saved-view, catalog, visibility, review-signal, and
review-assignment seams.

## Decision

Runroot adds a shared audit-catalog assignment-checklist contract with the
following properties:

- assignment checklists remain additive operator metadata
- assignment checklists reference existing catalog entries, review signals, and
  review assignments
- assignment checklists store only stable checklist state, thin checklist
  items, minimal actor and scope references, and existing catalog references
- assignment checklists do not snapshot audit facts, provider payloads, or
  workflow state
- assignment checklists do not change replay or approval source of truth
- applying a checklisted preset reuses the existing catalog-apply path

The shared checklist seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Checklist visibility stays minimal:

- list and inspect are scoped to operators already involved in the assignment
  handoff
- checklist status is a thin `pending|completed` operator-facing state
- no role matrix, permission framework, organization directory, threaded
  comments, or checklist workflow engine is added

## Consequences

### Positive

- assigned reviewed presets can carry thin checklist items and a stable handoff
  status through shared package-owned seams
- inline and queued runs reuse the same checklist contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- checklist metadata is still a derived layer that depends on assignment,
  review-signal, visibility, and catalog integrity
- checklist status intentionally stays shallow and does not solve broader
  workflow orchestration, RBAC, or collaboration requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- broader review workflow engines
- checklist-driven approval gating
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- broader checklist orchestration beyond thin operator handoff metadata
