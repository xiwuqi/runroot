# Audit Catalog Checklist Item Blockers

Phase 22 adds a thin shared checklist-item-blocker layer over progressed
assigned reviewed audit catalog entries that already carry checklist-item-
progress metadata.

## What Checklist Item Blockers Record

The shared contract stores:

- a reference to an existing progressed assigned reviewed catalog entry
- per-item blocker state for checklist items that already exist in the shared
  checklist-item-progress layer
- minimal operator and scope references used by the current operator seam
- an optional thin blocker note

The contract does not store:

- provider-specific payloads
- workflow-state snapshots
- replay or approval state
- threaded comments, broader review workflow engines, or broader checklist
  orchestration
- fine-grained RBAC or multi-tenant access rules
- surface-specific route formats

Checklist item blockers remain derived operator state. They do not replace
replay, approval, saved views, catalog entries, visibility, review signals,
review assignments, assignment checklists, or checklist-item progress.

## Block, List-Blocked, Inspect-Blocker, Clear-Blocker, And Apply

The minimum blocker path is available through the existing seams:

- SDK:
  - `blockCatalogEntry(id, ...)`
  - `listBlockedCatalogEntries()`
  - `getCatalogChecklistItemBlocker(id)`
  - `clearCatalogChecklistItemBlocker(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog/:catalogEntryId/blocker`
  - `GET /audit/catalog/blocked`
  - `GET /audit/catalog/:catalogEntryId/blocker`
  - `POST /audit/catalog/:catalogEntryId/blocker/clear`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog block`
  - `audit catalog blocked`
  - `audit catalog inspect-blocker`
  - `audit catalog clear-blocker`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin checklist-item-blocker panel and a minimal
    blocker-note form over the existing catalog, visibility, review-signal,
    review-assignment, assignment-checklist, and checklist-item-progress
    surfaces

## What Applying A Blocked Preset Does

Applying a blocked preset does not replay a run or reconstruct workflow state.

It only:

- resolves the visible catalog entry for the current operator identity
- resolves additive review, assignment, checklist, progress, and blocker
  metadata for that entry
- resolves the referenced saved view and constrained navigation metadata
- reuses the existing catalog-apply and audit-navigation seams
- returns the current navigation state for that blocked progressed preset

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Set a minimal operator identity for the current process:

```bash
$env:RUNROOT_OPERATOR_ID="ops_oncall"
$env:RUNROOT_OPERATOR_SCOPE="ops"
```

Create and block checklist items on a progressed assigned reviewed shared
preset:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog share catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog review catalog_entry_1 --state recommended --note "Ready for blockers"
pnpm --filter @runroot/cli dev audit catalog assign catalog_entry_1 --assignee ops_backup --handoff-note "Take the overnight follow-up"
pnpm --filter @runroot/cli dev audit catalog checklist catalog_entry_1 --status pending --items-json "[\"Validate worker state\",\"Confirm saved drilldown\"]"
pnpm --filter @runroot/cli dev audit catalog progress catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"completed\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"pending\"}]"
pnpm --filter @runroot/cli dev audit catalog block catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"cleared\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"blocked\"}]" --blocker-note "Waiting for overnight handoff"
pnpm --filter @runroot/cli dev audit catalog blocked
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog clear-blocker catalog_entry_1
```

Both inline-originated and queued-originated presets reuse the same
checklist-item-blocker contract through the configured persistence adapter.

## What Stays Deferred

Still out of scope after Phase 22:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- fine-grained RBAC, org or team management, and multi-tenant access models
- threaded comments, broader checklist orchestration, broader review
  workflows, or broader multi-user curation
- full observability backend integrations
- default persistence of provider-specific payloads or full derived audit
  snapshots
