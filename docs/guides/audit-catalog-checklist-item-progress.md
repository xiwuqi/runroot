# Audit Catalog Checklist Item Progress

Phase 21 adds a thin shared checklist-item-progress layer over assigned
reviewed audit catalog entries that already carry assignment-checklist
metadata.

## What Checklist Item Progress Records

The shared contract stores:

- a reference to an existing assigned reviewed catalog entry
- per-item progress for checklist items that already exist in the shared
  assignment-checklist layer
- minimal operator and scope references used by the current operator seam
- an optional thin completion note

The contract does not store:

- provider-specific payloads
- workflow-state snapshots
- replay or approval state
- threaded comments, broader review workflow engines, or broader checklist
  orchestration
- fine-grained RBAC or multi-tenant access rules
- surface-specific route formats

Checklist item progress remains derived operator state. It does not replace
replay, approval, saved views, catalog entries, visibility, review signals,
review assignments, or assignment checklists.

## Progress, List-Progressed, Inspect-Progress, Clear-Progress, And Apply

The minimum progress path is available through the existing seams:

- SDK:
  - `progressCatalogEntry(id, ...)`
  - `listProgressedCatalogEntries()`
  - `getCatalogChecklistItemProgress(id)`
  - `clearCatalogChecklistItemProgress(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog/:catalogEntryId/progress`
  - `GET /audit/catalog/progressed`
  - `GET /audit/catalog/:catalogEntryId/progress`
  - `POST /audit/catalog/:catalogEntryId/progress/clear`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog progress`
  - `audit catalog progressed`
  - `audit catalog inspect-progress`
  - `audit catalog clear-progress`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin checklist-item-progress panel and a minimal
    completion-note form over the existing catalog, visibility, review-signal,
    review-assignment, and assignment-checklist surfaces

## What Applying A Progressed Preset Does

Applying a progressed preset does not replay a run or reconstruct workflow
state.

It only:

- resolves the visible catalog entry for the current operator identity
- resolves additive review, assignment, checklist, and checklist-item-progress
  metadata for that entry
- resolves the referenced saved view and constrained navigation metadata
- reuses the existing catalog-apply and audit-navigation seams
- returns the current navigation state for that progressed assigned preset

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Set a minimal operator identity for the current process:

```bash
$env:RUNROOT_OPERATOR_ID="ops_oncall"
$env:RUNROOT_OPERATOR_SCOPE="ops"
```

Create and progress a checklist on an assigned reviewed shared preset:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog share catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog review catalog_entry_1 --state recommended --note "Ready for progress"
pnpm --filter @runroot/cli dev audit catalog assign catalog_entry_1 --assignee ops_backup --handoff-note "Take the overnight follow-up"
pnpm --filter @runroot/cli dev audit catalog checklist catalog_entry_1 --status pending --items-json "[\"Validate worker state\",\"Confirm saved drilldown\"]"
pnpm --filter @runroot/cli dev audit catalog progress catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"completed\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"pending\"}]" --completion-note "One follow-up remains open"
pnpm --filter @runroot/cli dev audit catalog progressed
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog clear-progress catalog_entry_1
```

Both inline-originated and queued-originated presets reuse the same
checklist-item-progress contract through the configured persistence adapter.

## What Stays Deferred

Still out of scope after Phase 21:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- fine-grained RBAC, org or team management, and multi-tenant access models
- threaded comments, broader checklist orchestration, broader review
  workflows, or broader multi-user curation
- full observability backend integrations
- default persistence of provider-specific payloads or full derived audit
  snapshots
