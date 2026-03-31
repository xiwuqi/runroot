# Audit Catalog Assignment Checklists

Phase 20 adds a thin shared assignment-checklist layer over assigned reviewed
audit view catalog entries.

## What Assignment Checklists Record

The shared contract stores:

- a reference to an existing assigned reviewed catalog entry
- stable checklist state: `pending` or `completed`
- minimal operator and scope references used by the current operator seam
- optional thin checklist items represented as short strings

The contract does not store:

- provider-specific payloads
- workflow-state snapshots
- replay or approval state
- threaded comments, broader review workflow engines, or broader checklist
  orchestration
- fine-grained RBAC or multi-tenant access rules
- surface-specific route formats

Assignment checklists remain derived operator state. They do not replace
replay, approval, saved views, catalog entries, visibility, review signals, or
review assignments.

## Checklist, List-Checklisted, Inspect-Checklist, Clear-Checklist, And Apply

The minimum checklist path is available through the existing seams:

- SDK:
  - `setCatalogAssignmentChecklist(id, ...)`
  - `listChecklistedCatalogEntries()`
  - `getCatalogAssignmentChecklist(id)`
  - `clearCatalogAssignmentChecklist(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog/:catalogEntryId/checklist`
  - `GET /audit/catalog/checklisted`
  - `GET /audit/catalog/:catalogEntryId/checklist`
  - `POST /audit/catalog/:catalogEntryId/checklist/clear`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog checklist`
  - `audit catalog checklisted`
  - `audit catalog inspect-checklist`
  - `audit catalog clear-checklist`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin assignment-checklist panel over the existing
    catalog, visibility, review-signal, and review-assignment surfaces

## What Applying A Checklisted Preset Does

Applying a checklisted preset does not replay a run or reconstruct workflow
state.

It only:

- resolves the visible catalog entry for the current operator identity
- resolves additive review, assignment, and checklist metadata for that entry
- resolves the referenced saved view and constrained navigation metadata
- reuses the existing catalog-apply and audit-navigation seams
- returns the current navigation state for that checklisted assigned preset

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Set a minimal operator identity for the current process:

```bash
$env:RUNROOT_OPERATOR_ID="ops_oncall"
$env:RUNROOT_OPERATOR_SCOPE="ops"
```

Create and checklist an assigned reviewed shared preset:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog share catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog review catalog_entry_1 --state recommended --note "Ready for handoff"
pnpm --filter @runroot/cli dev audit catalog assign catalog_entry_1 --assignee ops_backup --handoff-note "Take the overnight follow-up"
pnpm --filter @runroot/cli dev audit catalog checklist catalog_entry_1 --status pending --items-json "[\"Validate worker state\",\"Confirm saved drilldown\"]"
pnpm --filter @runroot/cli dev audit catalog checklisted
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog clear-checklist catalog_entry_1
```

Both inline-originated and queued-originated presets reuse the same checklist
contract through the configured persistence adapter.

## What Stays Deferred

Still out of scope after Phase 20:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- fine-grained RBAC, org or team management, and multi-tenant access models
- threaded comments, broader checklist orchestration, broader review workflows,
  or broader multi-user curation
- full observability backend integrations
- default persistence of provider-specific payloads or full derived audit
  snapshots
