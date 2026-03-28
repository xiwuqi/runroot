# Audit Projections

Phase 11 adds a minimal correlated audit view for one run at a time.

## What The Audit View Correlates

The shared audit projection joins additive facts that already exist in other
package seams:

- replay timeline events from persisted runtime and approval events
- dispatch job facts for queued execution
- worker identifiers when queued execution claims work
- persisted tool-history outcomes

Each audit entry stays scoped to one run and can correlate:

- run ID
- approval ID when the replay event carries one
- step ID
- dispatch job ID
- worker ID
- tool call ID and tool ID

## What The Audit View Does Not Change

- replay still derives only from persisted runtime and approval events
- approval semantics are unchanged
- audit projections do not define workflow correctness
- provider-specific raw tool payloads are still out of scope for the shared
  contract
- this phase does not add a dashboard product, cross-run analytics, or a full
  observability backend

## Read Path

The minimum run-scoped audit view is available through the existing seams:

- SDK: `getAuditView(runId)`
- API: `GET /runs/:runId/audit`
- CLI: `runs audit <run-id>`
- Web: run detail page shows a minimal audit section

## Local Development

Inline execution:

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
pnpm --filter @runroot/cli dev runs audit <run-id>
```

Queued execution:

```bash
pnpm dev:queued
```

Both paths keep replay and approval as source of truth while exposing the same
run-scoped audit view through the existing seams.

## Deferred Work

Still out of scope after Phase 11:

- full observability backend integration
- productized dashboards and broad analytics UX
- cross-run audit exploration products
- default persistence of every provider-specific tool payload
- hosted queue ops, autoscaling, and advanced scheduling
