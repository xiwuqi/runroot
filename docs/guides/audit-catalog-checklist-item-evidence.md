# Audit Catalog Checklist Item Evidence

Phase 25 adds a thin shared checklist-item-evidence layer over verified
resolved blocked progressed assigned reviewed audit catalog entries that
already carry checklist-item-verification metadata.

## What Checklist Item Evidence Records

The shared contract stores:

- a reference to an existing verified resolved blocked progressed assigned
  reviewed catalog entry
- per-item evidence references for checklist items that already exist in the
  shared checklist-item-verification layer
- minimal operator and scope references used by the current operator seam
- an optional thin evidence note

The contract does not store:

- provider-specific payloads
- copied binary artifacts
- workflow-state snapshots
- replay or approval state
- threaded comments, broader review workflow engines, or broader checklist
  orchestration
- fine-grained RBAC or multi-tenant access rules
- surface-specific route formats
- artifact-vault or attachment-upload product state

Checklist item evidence remains derived operator state. It does not replace
replay, approval, saved views, catalog entries, visibility, review signals,
review assignments, assignment checklists, checklist-item progress,
checklist-item blockers, checklist-item resolutions, or checklist-item
verifications.

## Record-Evidence, List-Evidenced, Inspect-Evidence, Clear-Evidence, And Apply

The minimum evidence path is available through the existing seams:

- SDK:
  - `recordCatalogEntryEvidence(id, ...)`
  - `listEvidencedCatalogEntries()`
  - `getCatalogChecklistItemEvidence(id)`
  - `clearCatalogChecklistItemEvidence(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog/:catalogEntryId/evidence`
  - `GET /audit/catalog/evidenced`
  - `GET /audit/catalog/:catalogEntryId/evidence`
  - `POST /audit/catalog/:catalogEntryId/evidence/clear`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog record-evidence`
  - `audit catalog evidenced`
  - `audit catalog inspect-evidence`
  - `audit catalog clear-evidence`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin checklist-item-evidence panel and a minimal
    evidence-note form over the existing catalog, visibility, review-signal,
    review-assignment, assignment-checklist, checklist-item-progress,
    checklist-item-blocker, checklist-item-resolution, and
    checklist-item-verification surfaces

## What Applying An Evidenced Preset Does

Applying an evidenced preset does not replay a run or reconstruct workflow
state.

It only:

- resolves the visible catalog entry for the current operator identity
- resolves additive review, assignment, checklist, progress, blocker,
  resolution, verification, and evidence metadata for that entry
- resolves the referenced saved view and constrained navigation metadata
- reuses the existing catalog-apply and audit-navigation seams
- returns the current navigation state for that evidenced verified preset

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Set a minimal operator identity for the current process:

```bash
$env:RUNROOT_OPERATOR_ID="ops_oncall"
$env:RUNROOT_OPERATOR_SCOPE="ops"
```

Create and record evidence references on a verified resolved blocked
progressed assigned reviewed shared preset:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog share catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog review catalog_entry_1 --state recommended --note "Ready for evidence"
pnpm --filter @runroot/cli dev audit catalog assign catalog_entry_1 --assignee ops_backup --handoff-note "Take the overnight follow-up"
pnpm --filter @runroot/cli dev audit catalog checklist catalog_entry_1 --status pending --items-json "[\"Validate worker state\",\"Confirm saved drilldown\"]"
pnpm --filter @runroot/cli dev audit catalog progress catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"completed\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"pending\"}]"
pnpm --filter @runroot/cli dev audit catalog block catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"cleared\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"blocked\"}]" --blocker-note "Waiting for overnight handoff"
pnpm --filter @runroot/cli dev audit catalog resolve catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"resolved\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"unresolved\"}]" --resolution-note "Backup confirmed the closeout"
pnpm --filter @runroot/cli dev audit catalog verify catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"verified\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"unverified\"}]" --verification-note "Owner verified the closeout"
pnpm --filter @runroot/cli dev audit catalog record-evidence catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"references\":[\"run://queued-worker/step/7\",\"note://backup-closeout\"]},{\"item\":\"Confirm saved drilldown\",\"references\":[\"doc://saved-drilldown\"]}]" --evidence-note "Thin evidence references only"
pnpm --filter @runroot/cli dev audit catalog evidenced
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog clear-evidence catalog_entry_1
```

Both inline-originated and queued-originated presets reuse the same
checklist-item-evidence contract through the configured persistence adapter.

## What Stays Deferred

Still out of scope after Phase 25:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- fine-grained RBAC, org or team management, and multi-tenant access models
- threaded comments, broader checklist orchestration, broader review
  workflows, or broader multi-user curation
- full observability backend integrations
- copied binary artifact persistence, provider payload persistence, or an
  artifact-vault product
