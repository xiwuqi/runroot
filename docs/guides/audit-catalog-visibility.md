# Audit Catalog Visibility

Phase 17 adds a thin shared-visibility layer over existing audit view catalogs.

## What Visibility Records

The shared contract stores:

- a reference to an existing catalog entry
- stable visibility state: `personal` or `shared`
- minimal ownership and scope references used by the current operator seam

The contract does not store:

- provider-specific payloads
- workflow-state snapshots
- replay or approval state
- fine-grained RBAC rules
- collaborative comments or review state
- surface-specific route formats

Visibility records remain derived operator state. They do not replace replay,
approval, saved views, or catalog entries.

## Share, List-Visible, Inspect, Unshare, And Apply

The minimum visibility path is available through the existing seams:

- SDK:
  - `shareCatalogEntry(id)`
  - `listVisibleCatalogEntries()`
  - `getCatalogVisibility(id)`
  - `unshareCatalogEntry(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog/:catalogEntryId/share`
  - `GET /audit/catalog/visible`
  - `GET /audit/catalog/:catalogEntryId/visibility`
  - `POST /audit/catalog/:catalogEntryId/unshare`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog share`
  - `audit catalog visible`
  - `audit catalog inspect`
  - `audit catalog unshare`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin visibility panel over the existing catalog
    and audit-navigation surface

## What Applying A Shared Preset Does

Applying a visible catalog entry does not replay a run or reconstruct
workflow state.

It only:

- resolves the visibility metadata for the current operator identity
- resolves the referenced catalog entry
- resolves the referenced constrained saved view
- reuses the existing saved-view and audit-navigation seams
- returns the current navigation state for that visible preset

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Set a minimal operator identity for the current process:

```bash
$env:RUNROOT_OPERATOR_ID="ops_oncall"
$env:RUNROOT_OPERATOR_SCOPE="ops"
```

Publish and share a queued preset:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog share catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog visible
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
```

Switch to another operator in the same scope and reopen the shared preset:

```bash
$env:RUNROOT_OPERATOR_ID="ops_backup"
$env:RUNROOT_OPERATOR_SCOPE="ops"
pnpm --filter @runroot/cli dev audit catalog visible
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
```

Both paths reuse the same shared visibility contract through the configured
persistence adapter.

## What Stays Deferred

Still out of scope after Phase 17:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- fine-grained RBAC, org or team management, and multi-tenant access models
- collaborative comments, review workflows, or broader multi-user curation
- full observability backend integrations
- default persistence of provider-specific payloads or full derived audit
  snapshots
