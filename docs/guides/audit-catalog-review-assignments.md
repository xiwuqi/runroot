# Audit Catalog Review Assignments

Phase 19 adds a thin shared review-assignment layer over reviewed audit view
catalog entries.

## What Review Assignments Record

The shared contract stores:

- a reference to an existing reviewed catalog entry
- stable assignment state: `assigned`
- minimal assigner, assignee, and scope references used by the current
  operator seam
- an optional handoff note

The contract does not store:

- provider-specific payloads
- workflow-state snapshots
- replay or approval state
- threaded comments, checklist-driven assignments, or broader review workflows
- fine-grained RBAC or multi-tenant access rules
- surface-specific route formats

Review assignments remain derived operator state. They do not replace replay,
approval, saved views, catalog entries, catalog visibility, or review signals.

## Assign, List-Assigned, Inspect-Assignment, Clear-Assignment, And Apply

The minimum assignment path is available through the existing seams:

- SDK:
  - `assignCatalogEntry(id, ...)`
  - `listAssignedCatalogEntries()`
  - `getCatalogReviewAssignment(id)`
  - `clearCatalogReviewAssignment(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog/:catalogEntryId/assignment`
  - `GET /audit/catalog/assigned`
  - `GET /audit/catalog/:catalogEntryId/assignment`
  - `POST /audit/catalog/:catalogEntryId/assignment/clear`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog assign`
  - `audit catalog assigned`
  - `audit catalog inspect-assignment`
  - `audit catalog clear-assignment`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin review-assignment panel over the existing
    catalog, visibility, review-signal, and navigation surface

## What Applying An Assigned Preset Does

Applying an assigned preset does not replay a run or reconstruct workflow
state.

It only:

- resolves the visible catalog entry for the current operator identity
- resolves the additive assignment metadata for that entry
- resolves the referenced review-signal and constrained saved view metadata
- reuses the existing catalog-apply and audit-navigation seams
- returns the current navigation state for that assigned reviewed preset

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Set a minimal operator identity for the current process:

```bash
$env:RUNROOT_OPERATOR_ID="ops_oncall"
$env:RUNROOT_OPERATOR_SCOPE="ops"
```

Assign a reviewed shared preset:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog share catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog review catalog_entry_1 --state recommended --note "Ready for handoff"
pnpm --filter @runroot/cli dev audit catalog assign catalog_entry_1 --assignee ops_backup --handoff-note "Take the overnight follow-up"
pnpm --filter @runroot/cli dev audit catalog assigned
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog clear-assignment catalog_entry_1
```

Both inline-originated and queued-originated presets reuse the same assignment
contract through the configured persistence adapter.

## What Stays Deferred

Still out of scope after Phase 19:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- fine-grained RBAC, org or team management, and multi-tenant access models
- threaded comments, checklist-driven assignments, review workflows, or broader
  multi-user curation
- full observability backend integrations
- default persistence of provider-specific payloads or full derived audit
  snapshots
