# Audit Catalog Checklist Item Resolutions

Phase 23 adds a thin shared checklist-item-resolution layer over blocked
progressed assigned reviewed audit catalog entries that already carry
checklist-item-blocker metadata.

## What Checklist Item Resolutions Record

The shared contract stores:

- a reference to an existing blocked progressed assigned reviewed catalog entry
- per-item resolution state for checklist items that already exist in the
  shared checklist-item-blocker layer
- minimal operator and scope refs used by the current operator seam
- an optional thin resolution note

The contract does not store:

- provider-specific payloads
- workflow-state snapshots
- replay or approval state
- threaded comments, broader review workflow engines, or broader checklist
  orchestration
- fine-grained RBAC or multi-tenant access rules
- surface-specific route formats

Checklist item resolutions remain derived operator state. They do not replace
replay, approval, saved views, catalog entries, visibility, review signals,
review assignments, assignment checklists, checklist-item progress, or
checklist-item blockers.

## Resolve, List-Resolved, Inspect-Resolution, Clear-Resolution, And Apply

The minimum resolution path is available through the existing seams:

- SDK:
  - `resolveCatalogEntry(id, ...)`
  - `listResolvedCatalogEntries()`
  - `getCatalogChecklistItemResolution(id)`
  - `clearCatalogChecklistItemResolution(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog/:catalogEntryId/resolution`
  - `GET /audit/catalog/resolved`
  - `GET /audit/catalog/:catalogEntryId/resolution`
  - `POST /audit/catalog/:catalogEntryId/resolution/clear`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog resolve`
  - `audit catalog resolved`
  - `audit catalog inspect-resolution`
  - `audit catalog clear-resolution`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin checklist-item-resolution panel and a minimal
    resolution-note form over the existing catalog, visibility, review-signal,
    review-assignment, assignment-checklist, checklist-item-progress, and
    checklist-item-blocker surfaces

## What Applying A Resolved Preset Does

Applying a resolved preset does not replay a run or reconstruct workflow state.

It only:

- resolves the visible catalog entry for the current operator identity
- resolves additive review, assignment, checklist, progress, blocker, and
  resolution metadata for that entry
- resolves the referenced saved view and constrained navigation metadata
- reuses the existing catalog-apply and audit-navigation seams
- returns the current navigation state for that resolved blocked progressed
  preset

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Set a minimal operator identity for the current process:

```bash
$env:RUNROOT_OPERATOR_ID="ops_oncall"
$env:RUNROOT_OPERATOR_SCOPE="ops"
```

Create and resolve checklist items on a blocked progressed assigned reviewed
shared preset:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog share catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog review catalog_entry_1 --state recommended --note "Ready for resolutions"
pnpm --filter @runroot/cli dev audit catalog assign catalog_entry_1 --assignee ops_backup --handoff-note "Take the overnight follow-up"
pnpm --filter @runroot/cli dev audit catalog checklist catalog_entry_1 --status pending --items-json "[\"Validate worker state\",\"Confirm saved drilldown\"]"
pnpm --filter @runroot/cli dev audit catalog progress catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"completed\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"pending\"}]"
pnpm --filter @runroot/cli dev audit catalog block catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"cleared\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"blocked\"}]" --blocker-note "Waiting for overnight handoff"
pnpm --filter @runroot/cli dev audit catalog resolve catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"resolved\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"unresolved\"}]" --resolution-note "Backup is validating the final handoff"
pnpm --filter @runroot/cli dev audit catalog resolved
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog clear-resolution catalog_entry_1
```

Both inline-originated and queued-originated presets reuse the same
checklist-item-resolution contract through the configured persistence adapter.

## What Stays Deferred

Still out of scope after Phase 23:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- fine-grained RBAC, org or team management, and multi-tenant access models
- threaded comments, broader checklist orchestration, broader review
  workflows, or broader multi-user curation
- full observability backend integrations
- default persistence of provider-specific payloads or full derived audit
  snapshots
