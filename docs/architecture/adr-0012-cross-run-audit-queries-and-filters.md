# ADR-0012: Cross-Run Audit Queries And Filters

## Status

Accepted

## Context

Phase 11 introduced a run-scoped correlated audit view that joins replay,
dispatch, worker, and tool-history facts for one run at a time. That closed
the single-run audit gap but still left operators without a shared way to
query those derived facts across multiple runs through existing seams.

Runroot needs a minimal next step that stays derived and operator-facing:

- replay and approval remain the workflow source of truth
- additive tool, worker, and dispatch facts stay optional audit context
- cross-run queries stay package-owned rather than moving query logic into apps
- web, API, and CLI must remain thin operator surfaces instead of growing into
  dashboards or analytics platforms

## Decision

Phase 12 adds a shared cross-run audit query and filter contract plus thin
operator-facing read paths.

1. `@runroot/replay` owns the shared cross-run audit query contract.
   - The contract returns structured, run-scoped audit summaries across
     multiple runs.
   - Filters stay narrow and structured: definition ID, run status, execution
     mode, and tool name.
   - The query reads derived audit facts without redefining workflow
     correctness.
2. `@runroot/sdk` owns thin cross-run audit wiring.
   - Operator services expose `listAuditResults(filters?)`.
   - Read paths may reuse the existing runtime, dispatch, and tool-history
     seams, but they do not introduce a new orchestration model.
3. API, CLI, and web stay thin.
   - API exposes a single cross-run audit endpoint through the existing
     operator service.
   - CLI exposes a thin `audit list` command.
   - Web adds minimal cross-run audit presentation on the existing runs
     surface and does not become a dashboard product.
4. Replay and approval remain source of truth.
   - Cross-run audit results never feed runtime transitions, replay
     reconstruction, or approval decisions.
   - Additive tool, worker, and dispatch facts remain read-only operator
     context.

## Consequences

### Positive

- operators can answer simple cross-run questions without stitching together
  separate single-run reads
- inline and queued execution paths share one thin cross-run query model
- the repository closes an operator ergonomics gap without jumping into a full
  analytics or observability platform

### Negative

- cross-run queries add another derived read model that must stay clearly
  separated from replay semantics
- even a narrow filter surface can drift toward analytics-product scope if not
  kept under review
- query summaries must avoid coupling to storage layout or indexing details

## Non-Goals

This ADR does not introduce:

- a full observability backend, log shipping, metrics, alerting, or SLO stack
- productized dashboards, broad analytics UX, or open-ended search products
- replay reconstruction from cross-run audit results
- default persistence of every provider-specific tool payload
- hosted queue operations, autoscaling, advanced scheduling, or broader
  platform work
- Phase 13 or later expansion
