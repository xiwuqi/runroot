# Audit Queries

Phase 12 adds a thin, shared cross-run audit query path over the derived audit
facts already exposed by replay, dispatch, worker, and tool-history seams.

## What The Query Returns

The shared contract returns structured, cross-run audit summaries:

- run ID, definition ID, and definition name
- run status and latest correlated fact timestamp
- stable approval summaries when approval events exist
- dispatch job summaries when queued execution is involved
- tool-call summaries and execution modes
- worker IDs and step IDs when additive facts provide them

The shared query is additive and operator-facing. It does not replace replay,
approval, or runtime state.

## Supported Filters

Phase 12 intentionally keeps filtering narrow and structured:

- `definitionId`
- `runStatus`
- `executionMode`
- `toolName`

This phase does not add broad text search, dashboard drill-downs, or
open-ended analytics products.

## Read Path

The minimum cross-run audit query is available through the existing seams:

- SDK: `listAuditResults(filters?)`
- API: `GET /audit/runs`
- CLI: `audit list`
- Web: the runs page shows a minimal cross-run audit query section

## What Stays Unchanged

- replay still derives only from persisted runtime and approval events
- approval semantics are unchanged
- correlated audit facts remain additive read data
- provider-specific raw payloads stay out of the shared contract
- this phase does not add a full observability backend, dashboard product, or
  broad analytics platform

## Local Development

Inline-originated runs:

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
pnpm --filter @runroot/cli dev audit list --execution-mode inline
```

Queued-originated runs:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit list --execution-mode queued
```

Both paths return the same shared cross-run audit result shape through the
existing operator seams.

## Deferred Work

Still out of scope after Phase 12:

- full observability backend integration
- productized dashboards and broad analytics UX
- open-ended search products
- default persistence of every provider-specific payload
- hosted queue ops, autoscaling, and advanced scheduling
