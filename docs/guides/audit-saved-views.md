# Audit Saved Views

Phase 15 adds a thin, shared saved-view path over the existing audit
navigation model.

## What Saved Views Record

The shared contract stores:

- stable cross-run summary filters
- stable identifier-driven drilldown filters
- optional stable navigation references such as a run audit-view target that
  augment an already constrained saved view
- metadata needed to list and reopen the saved view later

The contract does not store:

- provider-specific payloads
- full audit fact snapshots
- replay or approval state
- surface-specific URL formats

Saved views still require at least one stable summary or drilldown filter.
References alone do not make a saved view valid.

## Read And Write Path

The minimum save/list/load/apply path is available through the existing seams:

- SDK: `saveSavedView(...)`, `listSavedViews()`, `getSavedView(id)`,
  `applySavedView(id)`
- API:
  - `POST /audit/saved-views`
  - `GET /audit/saved-views`
  - `GET /audit/saved-views/:savedViewId`
  - `GET /audit/saved-views/:savedViewId/apply`
- CLI:
  - `audit saved-views save`
  - `audit saved-views list`
  - `audit saved-views show`
  - `audit saved-views apply`
- Web: the runs page presents a thin saved-view panel over the existing
  navigation surface

## What Applying A Saved View Does

Applying a saved view does not replay a run or reconstruct workflow state.

It only:

- loads the saved filter and reference state
- requires the saved view to remain constrained by stable filters
- re-runs the existing audit navigation query through the shared seam
- returns the current summaries, drilldowns, and linked run-audit references

Replay and approval semantics still come only from persisted runtime and
approval events.

## Local Development

Inline-originated saved views:

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
pnpm --filter @runroot/cli dev audit saved-views save --name "inline run" --run-id run_1
pnpm --filter @runroot/cli dev audit saved-views apply saved_view_1
```

Queued-originated saved views:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit saved-views save --name "queued worker" --execution-mode queued --worker-id worker_1
pnpm --filter @runroot/cli dev audit saved-views list
```

Both paths persist the same shared saved-view shape through the configured
persistence adapter.

## What Stays Deferred

Still out of scope after Phase 15:

- productized dashboards or saved-view catalogs
- collaborative sharing, RBAC-governed presets, or multi-user curation
- broad analytics UX or open-ended search products
- full observability backend integrations
- default persistence of provider-specific payloads or full derived audit
  snapshots
