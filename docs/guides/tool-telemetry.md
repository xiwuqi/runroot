# Tool Telemetry

Phase 10 adds persisted tool history and minimal execution telemetry
correlation.

## What Gets Persisted

Tool telemetry records additive audit facts for each tool invocation:

- call ID
- run ID and step ID when available
- dispatch job ID and worker ID for queued execution
- execution mode (`inline` or `queued`)
- tool ID, tool name, and tool source
- started and finished timestamps
- outcome (`succeeded`, `failed`, or `blocked`)
- generic input and output summaries

The shared contract intentionally avoids persisting every provider-specific
request or response payload.

## What Stays Unchanged

- replay still comes only from persisted runtime and approval events
- approval semantics are unchanged
- tool history is additive audit data, not workflow state source of truth
- this phase does not add a dashboard product, metrics platform, or alerting
  stack

## Storage Path

Tool history follows the active persistence mode:

- Postgres: stored in the same database as runtime and dispatch state
- SQLite: stored in the same local database file as runtime and dispatch state
- legacy file compatibility: stored in a sidecar JSON file next to the
  workspace snapshot

No extra environment variables are required in this phase.

## Read Path

The minimum read path is available through existing seams:

- SDK: `getToolHistory(runId)`
- API: `GET /runs/:runId/tool-history`
- Web: run detail page shows a minimal persisted tool-history section

## Local Development

Inline execution:

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
```

Queued execution:

```bash
pnpm dev:queued
```

Both paths persist tool history automatically behind the existing persistence
and execution seams.
