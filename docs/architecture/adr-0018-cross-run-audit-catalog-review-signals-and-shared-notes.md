# ADR-0018: Cross-Run Audit Catalog Review Signals And Shared Notes

## Status

Accepted

## Context

Phase 17 introduced shared catalog visibility and shared presets. That closed
the gap where curated presets could move between personal and shared visibility
through package-owned seams, but visible presets still had no shared,
package-owned way to carry thin review state or a reusable shared note.

Runroot still needs a smaller next step than a collaborative review product,
fine-grained RBAC platform, multi-tenant SaaS control plane, dashboard,
analytics suite, or search product:

- replay and approval remain workflow source of truth
- additive saved-view, catalog, and visibility records remain operator context
- visible presets are the existing reusable baseline
- API, CLI, SDK, and web remain thin operator surfaces

## Decision

Phase 18 adds a shared audit-catalog review-signal contract plus thin
review/list-reviewed/inspect-review/clear-review/apply paths.

1. `@runroot/replay` owns the shared review-signal contract.
   - Review-signal records reference an existing visible catalog entry through
     stable ids.
   - The contract stores only minimal review state, actor and scope
     references, and an optional shared note.
   - The contract does not snapshot audit facts, provider payloads,
     workflow-state models, or threaded collaboration state.
2. `@runroot/persistence` owns additive review-signal storage adapters.
   - File, SQLite, and Postgres adapters persist the same review-signal shape.
   - Persistence remains additive and separate from replay, approval, runtime,
     catalog publication, and visibility transitions.
3. `@runroot/sdk` owns thin review-signal wiring.
   - Operator services expose `reviewCatalogEntry`,
     `listReviewedCatalogEntries`, `getCatalogReviewSignal`, and
     `clearCatalogReviewSignal`.
   - Reviewed presets still reopen through the existing `applyCatalogEntry`
     path instead of a new orchestration surface.
4. API, CLI, and web stay thin.
   - API exposes minimal review-signal endpoints through the operator service.
   - CLI exposes thin `audit catalog reviewed|review|inspect-review|clear-review`
     commands.
   - Web presents a small review-signal panel on the existing runs surface.
5. Replay and approval remain source of truth.
   - Review signals and shared notes never feed runtime transitions, replay
     reconstruction, or approval decisions.
   - Additive audit facts remain read-only operator context.

## Consequences

### Positive

- operators can mark visible presets as recommended or reviewed through the
  same package-owned seams
- inline and queued execution paths share one thin review-signal model
- the repository closes a narrow curation gap without expanding into threaded
  collaboration, review workflows, or a search and analytics surface

### Negative

- review signals add another derived layer that must stay separated from replay
  and approval semantics
- the contract can drift toward collaboration, assignments, RBAC, or
  multi-tenant products if note and actor metadata are allowed to expand
- reviewed presets still depend on existing catalog and visibility references,
  so custom reader wiring can misconfigure the full derived path

## Non-Goals

This ADR does not introduce:

- a full observability backend, log shipping, metrics, alerting, or SLO stack
- productized dashboards, discovery products, broad analytics UX, or
  open-ended search products
- replay reconstruction from review signals or shared notes
- default persistence of every provider-specific payload or full audit snapshot
- fine-grained RBAC, org-directory management, or multi-tenant access control
- threaded comments, assignments, review workflows, or broader multi-user
  curation
- hosted queue operations, autoscaling, advanced scheduling, or broader
  platform work
- Phase 19 or later expansion
