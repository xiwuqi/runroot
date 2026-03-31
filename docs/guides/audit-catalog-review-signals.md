# Audit Catalog Review Signals

Phase 18 adds a thin shared review-signal layer over visible audit view
catalogs.

## What Review Signals Record

The shared contract stores:

- a reference to an existing visible catalog entry
- stable review state: `recommended` or `reviewed`
- minimal actor and scope references used by the current operator seam
- an optional shared note

The contract does not store:

- provider-specific payloads
- workflow-state snapshots
- replay or approval state
- threaded comments, checklist-driven assignments, or broader review workflows
- fine-grained RBAC or multi-tenant access rules
- surface-specific route formats

Review signals remain derived operator state. They do not replace replay,
approval, saved views, catalog entries, or catalog visibility.

## Review, List-Reviewed, Inspect-Review, Clear-Review, And Apply

The minimum review path is available through the existing seams:

- SDK:
  - `reviewCatalogEntry(id, ...)`
  - `listReviewedCatalogEntries()`
  - `getCatalogReviewSignal(id)`
  - `clearCatalogReviewSignal(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog/:catalogEntryId/review`
  - `GET /audit/catalog/reviewed`
  - `GET /audit/catalog/:catalogEntryId/review`
  - `POST /audit/catalog/:catalogEntryId/review/clear`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog review`
  - `audit catalog reviewed`
  - `audit catalog inspect-review`
  - `audit catalog clear-review`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin review-signal panel over the existing
    catalog, saved-view, and navigation surface

## What Applying A Reviewed Preset Does

Applying a reviewed preset does not replay a run or reconstruct workflow
state.

It only:

- resolves the visible catalog entry for the current operator identity
- resolves the additive review-signal metadata for that entry
- resolves the referenced constrained saved view
- reuses the existing catalog-apply and audit-navigation seams
- returns the current navigation state for that reviewed preset

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Set a minimal operator identity for the current process:

```bash
$env:RUNROOT_OPERATOR_ID="ops_oncall"
$env:RUNROOT_OPERATOR_SCOPE="ops"
```

Review a shared queued preset:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog share catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog review catalog_entry_1 --state recommended --note "Preferred queued follow-up"
pnpm --filter @runroot/cli dev audit catalog reviewed
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog clear-review catalog_entry_1
```

Both inline-originated and queued-originated presets reuse the same review
contract through the configured persistence adapter.

Phase 19 adds a separate thin assignment and handoff layer for reviewed
presets. Review signals still stay responsible only for stable review state and
optional shared notes.

## What Stays Deferred

Still out of scope after Phase 19:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- fine-grained RBAC, org or team management, and multi-tenant access models
- threaded comments, checklist-driven assignments, review workflows, or broader multi-user
  curation
- full observability backend integrations
- default persistence of provider-specific payloads or full derived audit
  snapshots
