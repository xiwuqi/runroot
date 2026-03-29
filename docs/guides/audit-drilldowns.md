# Audit Drilldowns

Phase 13 adds a thin, shared cross-run audit drilldown path over the derived
audit facts already exposed by replay, dispatch, worker, and tool-history
seams.

## What The Drilldown Returns

The shared contract returns constrained, run-scoped drilldown results:

- run ID, definition ID, definition name, and run status
- matched correlated audit entries for the requested identifiers
- stable identifier summaries collected from the matched entries
- the latest matched fact timestamp per run

The drilldown remains additive and operator-facing. It does not replace replay,
approval, or runtime state.

## Supported Identifier Filters

Phase 13 intentionally keeps drilldowns narrow and structured:

- `runId`
- `approvalId`
- `stepId`
- `dispatchJobId`
- `workerId`
- `toolCallId`
- `toolId`

At least one identifier should be supplied. This phase does not add broad text
search, productized dashboards, or open-ended analytics exploration.

## Read Path

The minimum cross-run drilldown path is available through the existing seams:

- SDK: `listAuditDrilldowns(filters?)`
- API: `GET /audit/drilldowns`
- CLI: `audit drilldown`
- Web: the runs page shows a minimal drilldown section beside the existing
  cross-run audit query section

## What Stays Unchanged

- replay still derives only from persisted runtime and approval events
- approval semantics are unchanged
- correlated audit facts remain additive read data
- provider-specific raw payloads stay out of the shared contract
- this phase does not add a full observability backend, dashboard product, or
  open-ended search and analytics platform

## Local Development

Inline-originated drilldowns:

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
pnpm --filter @runroot/cli dev audit drilldown --tool-id builtin.shell.runbook
```

Queued-originated drilldowns:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit drilldown --worker-id worker_1
```

Both paths return the same shared drilldown result shape through the existing
operator seams.

## Deferred Work

Still out of scope after Phase 13:

- full observability backend integration
- productized dashboards and broad analytics UX
- open-ended search products
- default persistence of every provider-specific payload
- hosted queue ops, autoscaling, and advanced scheduling
