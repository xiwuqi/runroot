# Audit Catalog Checklist Item Sign-Offs

Phase 28 adds a thin shared checklist-item-signoff layer over acknowledged
attested evidenced verified resolved blocked progressed assigned reviewed audit
catalog entries that already carry checklist-item-acknowledgment metadata.

## What Checklist Item Sign-Offs Record

The shared contract stores:

- a reference to an existing acknowledged attested evidenced verified resolved
  blocked progressed assigned reviewed catalog entry
- per-item sign-off state for checklist items that already exist in the shared
  checklist-item-acknowledgment layer
- minimal operator and scope references used by the current operator seam
- an optional thin sign-off note

The contract does not store:

- provider-specific payloads
- copied artifacts
- workflow-state snapshots
- replay or approval state
- threaded comments, broader review workflow engines, or broader checklist
  orchestration
- fine-grained RBAC or multi-tenant access rules
- surface-specific route formats
- approval-gating product state
- attachment-upload or artifact-vault product state

Checklist item sign-offs remain derived operator state. They do not replace
replay, approval, saved views, catalog entries, visibility, review signals,
review assignments, assignment checklists, checklist-item progress,
checklist-item blockers, checklist-item resolutions, checklist-item
verifications, checklist-item evidence, checklist-item attestations, or
checklist-item acknowledgments.

## Sign-Off, List-Signed-Off, Inspect-Sign-Off, Clear-Sign-Off, And Apply

The minimum sign-off path is available through the existing seams:

- SDK:
  - `signOffCatalogEntry(id, ...)`
  - `listSignedOffCatalogEntries()`
  - `getCatalogChecklistItemSignoff(id)`
  - `clearCatalogChecklistItemSignoff(id)`
  - `applyCatalogEntry(id)`
- API:
  - `POST /audit/catalog/:catalogEntryId/sign-off`
  - `GET /audit/catalog/signed-off`
  - `GET /audit/catalog/:catalogEntryId/sign-off`
  - `POST /audit/catalog/:catalogEntryId/sign-off/clear`
  - `GET /audit/catalog/:catalogEntryId/apply`
- CLI:
  - `audit catalog sign-off`
  - `audit catalog signed-off`
  - `audit catalog inspect-sign-off`
  - `audit catalog clear-sign-off`
  - `audit catalog apply`
- Web:
  - the runs page presents a thin checklist-item-signoff panel and a minimal
    sign-off-note form over the existing catalog, visibility, review-signal,
    review-assignment, assignment-checklist, checklist-item-progress,
    checklist-item-blocker, checklist-item-resolution,
    checklist-item-verification, checklist-item-evidence,
    checklist-item-attestation, and checklist-item-acknowledgment surfaces

## What Applying A Signed-Off Preset Does

Applying a signed-off preset does not replay a run, reconstruct workflow
state, or change approval semantics.

It only:

- resolves the visible catalog entry for the current operator identity
- resolves additive review, assignment, checklist, progress, blocker,
  resolution, verification, evidence, attestation, acknowledgment, and
  sign-off metadata for that entry
- resolves the referenced saved view and constrained navigation metadata
- reuses the existing catalog-apply and audit-navigation seams
- returns the current navigation state for that signed-off acknowledged preset

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Set a minimal operator identity for the current process:

```bash
$env:RUNROOT_OPERATOR_ID="ops_oncall"
$env:RUNROOT_OPERATOR_SCOPE="ops"
```

Create and record sign-offs on an acknowledged attested evidenced verified
resolved blocked progressed assigned reviewed shared preset:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit catalog publish saved_view_1 --name "Queued preset"
pnpm --filter @runroot/cli dev audit catalog share catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog review catalog_entry_1 --state recommended --note "Ready for sign-off"
pnpm --filter @runroot/cli dev audit catalog assign catalog_entry_1 --assignee ops_backup --handoff-note "Take the overnight follow-up"
pnpm --filter @runroot/cli dev audit catalog checklist catalog_entry_1 --status pending --items-json "[\"Validate worker state\",\"Confirm saved drilldown\"]"
pnpm --filter @runroot/cli dev audit catalog progress catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"completed\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"pending\"}]"
pnpm --filter @runroot/cli dev audit catalog block catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"cleared\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"blocked\"}]" --blocker-note "Waiting for overnight handoff"
pnpm --filter @runroot/cli dev audit catalog resolve catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"resolved\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"unresolved\"}]" --resolution-note "Backup confirmed the closeout"
pnpm --filter @runroot/cli dev audit catalog verify catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"verified\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"unverified\"}]" --verification-note "Owner verified the closeout"
pnpm --filter @runroot/cli dev audit catalog record-evidence catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"references\":[\"run://queued-worker/step/7\",\"note://backup-closeout\"]},{\"item\":\"Confirm saved drilldown\",\"references\":[\"doc://saved-drilldown\"]}]" --evidence-note "Thin evidence references only"
pnpm --filter @runroot/cli dev audit catalog attest catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"attested\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"unattested\"}]" --attestation-note "Owner attested the stable evidence references"
pnpm --filter @runroot/cli dev audit catalog acknowledge catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"acknowledged\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"unacknowledged\"}]" --acknowledgment-note "Backup acknowledged the attested evidence set"
pnpm --filter @runroot/cli dev audit catalog sign-off catalog_entry_1 --items-json "[{\"item\":\"Validate worker state\",\"state\":\"signed-off\"},{\"item\":\"Confirm saved drilldown\",\"state\":\"unsigned\"}]" --signoff-note "Backup signed off the acknowledged evidence set"
pnpm --filter @runroot/cli dev audit catalog signed-off
pnpm --filter @runroot/cli dev audit catalog apply catalog_entry_1
pnpm --filter @runroot/cli dev audit catalog clear-sign-off catalog_entry_1
```

Both inline-originated and queued-originated presets reuse the same
checklist-item-signoff contract through the configured persistence adapter.

## What Stays Deferred

Still out of scope after Phase 28:

- productized dashboards, discovery products, or broad analytics UX
- open-ended search products
- fine-grained RBAC, org or team management, and multi-tenant access models
- threaded comments, broader checklist orchestration, broader review
  workflows, or broader multi-user curation
- full observability backend integrations
- provider payload persistence, copied artifact persistence, approval-gating
  products, attachment-upload, or artifact-vault products
