# Audit Navigation

Phase 14 adds a thin, shared audit-navigation path over the existing cross-run
audit summaries, identifier-driven drilldowns, and run-scoped audit views.

## What The Navigation Returns

The shared contract returns linked operator-facing navigation data:

- cross-run summary results plus stable navigation links
- identifier-driven drilldown results plus links back to the existing run audit
  view
- stable references that let surfaces move between summaries, drilldowns, and
  run-scoped audit views without surface-specific stitching

The navigation contract remains additive and operator-facing. It does not
replace replay, approval, or runtime state.

## Supported Navigation Shape

Phase 14 intentionally keeps navigation narrow:

- summary filters stay the same as Phase 12
- drilldown filters stay the same as Phase 13
- navigation links only connect summaries to drilldowns and drilldowns to the
  existing run audit view

This phase does not add dashboards, open-ended search, or broad analytics UX.

## Read Path

The minimum navigation path is available through the existing seams:

- SDK: `getAuditNavigation(filters?)`
- API: `GET /audit/navigation`
- CLI: `audit navigate`
- Web: the runs page presents linked navigation between summaries,
  identifier-driven drilldowns, and run-scoped audit views

## What Stays Unchanged

- replay still derives only from persisted runtime and approval events
- approval semantics are unchanged
- additive audit facts remain read-only operator data
- provider-specific raw payloads stay out of the shared contract
- this phase does not add a full observability backend, dashboard product, or
  open-ended search and analytics platform

## Local Development

Inline-originated navigation:

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
pnpm --filter @runroot/cli dev audit navigate --run-id run_1
```

Queued-originated navigation:

```bash
pnpm dev:queued
pnpm --filter @runroot/cli dev audit navigate --execution-mode queued --worker-id worker_1
```

Both paths return the same shared navigation shape through the existing
operator seams.

## Deferred Work

Still out of scope after Phase 14:

- full observability backend integration
- productized dashboards and broad analytics UX
- open-ended search products
- default persistence of every provider-specific payload
- hosted queue ops, autoscaling, and advanced scheduling
