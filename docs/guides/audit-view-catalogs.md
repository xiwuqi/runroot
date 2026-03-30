# Audit View Catalogs

Phase 16 adds a thin, shared catalog layer over constrained saved audit views.

Phase 17 adds a separate visibility layer over those catalog entries. Catalog
publication still defines reusable presets; visibility metadata now determines
whether those presets stay personal or become shared through the same operator
seams.

Phase 18 adds a separate review-signal layer over visible catalog entries.
Catalog publication still defines reusable presets; review signals and shared
notes now annotate those presets through the same operator seams without
turning catalog entries into a threaded collaboration product.

## What Catalog Entries Record

The shared contract stores:

- a reference to an existing constrained saved view
- stable catalog metadata such as name and optional description
- archive state used to hide an entry from the active catalog list

The contract does not store:

- provider-specific payloads
- workflow-state snapshots
- replay or approval state
- review-signal or shared-note metadata
- collaborative sharing or RBAC metadata
- surface-specific route formats

Catalog entries remain derived operator state. They do not replace replay,
approval, or saved-view constraints.

## Publish, List, Inspect, Archive, And Apply

The minimum catalog path is available through the existing seams:

- SDK:
  - `publishCatalogEntry(...)`
  - `listCatalogEntries()`
  - `getCatalogEntry(id)`
  - `archiveCatalogEntry(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog`
  - `GET /audit/catalog`
  - `GET /audit/catalog/:catalogEntryId`
  - `POST /audit/catalog/:catalogEntryId/archive`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog publish`
  - `audit catalog list`
  - `audit catalog show`
  - `audit catalog archive`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin catalog panel over the existing saved-view
    and navigation surface

## What Applying A Catalog Entry Does

Applying a catalog entry does not replay a run or reconstruct workflow state.

It only:

- loads the catalog entry metadata
- resolves the referenced constrained saved view
- reuses the existing saved-view and audit-navigation seams
- returns the current navigation state for that saved view

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Inline-originated catalog entries:

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
pnpm --filter @runroot/cli dev audit saved-views save --name "inline run" --run-id run_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Inline preset"
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
```

Queued-originated catalog entries:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_2 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog list
```

Both paths persist the same shared catalog-entry shape through the configured
persistence adapter.

## What Stays Deferred

Still out of scope after Phase 16:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- collaborative sharing, RBAC-governed catalogs, or multi-user curation
- full observability backend integrations
- default persistence of provider-specific payloads or full derived audit
  snapshots
