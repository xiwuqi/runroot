# ADR-0025: Cross-Run Audit Catalog Checklist Item Evidence References and Evidence Notes

Date: 2026-04-02

## Status

Accepted on branch for Phase 25 implementation.

## Context

Phase 24 added a thin checklist-item-verification layer over resolved blocked
progressed assigned reviewed audit catalog entries. Operators could attach
per-item verification state and a single verification note through shared SDK,
API, CLI, and web seams, but there was still no package-owned way to attach
stable evidence references to those verified checklist items without expanding
into provider payload persistence, copied binary artifact persistence, or an
artifact-vault product.

The next repository-owned gap is still narrower than threaded collaboration,
broader checklist orchestration, broader review workflow engines,
fine-grained RBAC, multi-tenant access, dashboards, search, analytics, or a
binary-upload product. Runroot needs a stable checklist-item-evidence layer
that remains derived over the existing checklist-item-verification,
checklist-item-resolution, checklist-item-blocker, checklist-item-progress,
assignment-checklist, review-assignment, review-signal, visibility, catalog,
and saved-view seams.

## Decision

Runroot adds a shared audit-catalog checklist-item-evidence contract with the
following properties:

- checklist item evidence remains additive operator metadata
- checklist item evidence references existing catalog entries,
  checklist-item-verifications, checklist-item-resolutions,
  checklist-item-blockers, checklist-item-progress, assignment checklists,
  review assignments, and review signals
- checklist item evidence stores only stable per-item evidence references, a
  thin optional evidence note, minimal actor and scope references, and
  existing catalog refs
- checklist item evidence does not snapshot audit facts, provider payloads,
  copied binary artifacts, or workflow state
- checklist item evidence does not change replay or approval source of truth
- applying an evidenced preset reuses the existing catalog-apply path

The shared evidence seam is exposed through:

- replay query helpers in `@runroot/replay`
- persistence adapters in `@runroot/persistence`
- operator methods in `@runroot/sdk`
- thin HTTP routes in `apps/api`
- thin command routing in `@runroot/cli`
- minimal runs-page presentation in `apps/web`

Evidence visibility stays minimal:

- list and inspect are scoped to operators already involved in the
  verification, resolution, blocker, progress, and assignment handoff path
- evidence entries can only reference checklist items that already exist in the
  shared checklist-item-verification layer
- evidence references stay as thin stable strings
- evidence notes stay as a single thin string
- no threaded comments, checklist workflow engine, permission framework,
  organization directory, multi-tenant surface, attachment-upload product, or
  artifact vault is added

## Consequences

### Positive

- verified resolved blocked progressed assigned reviewed presets can carry thin
  per-item evidence references and a single evidence note through shared
  package-owned seams
- inline and queued runs reuse the same checklist-item-evidence contract
- operator surfaces stay thin and reuse the existing catalog apply behavior
- replay and approval semantics remain unchanged

### Negative

- checklist item evidence is still a derived layer that depends on
  checklist-item verifications, checklist-item resolutions, checklist-item
  blockers, checklist-item progress, assignment checklists, assignments,
  review signals, visibility, and catalog integrity
- evidence intentionally stays shallow and does not solve broader checklist
  orchestration, threaded collaboration, binary artifact persistence, RBAC, or
  multi-tenant requirements

## Non-Goals

This ADR does not introduce:

- threaded comments
- broader review workflow engines
- broader checklist orchestration
- evidence-driven approval gating
- attachment-upload or artifact-vault products
- fine-grained RBAC
- multi-tenant access control
- dashboard, search, or analytics products
- broader collaboration beyond thin operator-facing evidence metadata
