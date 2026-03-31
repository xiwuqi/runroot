# ADR-0019: Cross-Run Audit Catalog Review Assignments And Operator Handoffs

Date: 2026-03-30

## Status

Accepted on branch for Phase 19 implementation.

## Context

Phase 18 added a thin review-signal layer over visible audit catalog entries.
Operators could mark a preset as recommended or reviewed and attach an optional
shared note, but there was still no package-owned way to hand that reviewed
preset to a specific operator through the same SDK, API, CLI, and web seams.

The next gap is narrower than threaded collaboration, fine-grained RBAC,
multi-tenant access, dashboards, search, or analytics. The repository needs a
stable review-assignment layer that remains derived over the existing
saved-view, catalog, visibility, and review-signal seams.

## Decision

Runroot adds a shared audit-catalog review-assignment contract with the
following properties:

- assignments remain additive operator metadata
- assignments reference existing catalog entries and review signals
- assignments store only stable assigner, assignee, scope, state, and optional
  handoff-note metadata
- assignments do not snapshot audit facts, provider payloads, or workflow state
- assignments do not change replay or approval source of truth
- applying an assigned preset reuses the existing catalog-apply path

The shared assignment seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Assignment visibility stays minimal:

- list and inspect are scoped to operators involved in the handoff
- no role matrix, permission framework, or organization directory is added
- no threaded comment model, checklist workflow, or assignment queue product is
  introduced

## Consequences

### Positive

- reviewed presets can be handed off through shared package-owned seams
- inline and queued runs reuse the same assignment contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- assignment metadata is still a derived layer that depends on catalog,
  visibility, and review-signal integrity
- cross-operator visibility remains intentionally narrow and does not solve
  broader collaboration or RBAC requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- checklist-driven assignments
- review workflow engines
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- assignment-driven approval semantics
