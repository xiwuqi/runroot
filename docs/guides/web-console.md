# Web Console

The Phase 6 web console is a thin visualization layer over the existing Runroot API.

## Start The API And Web Console

```bash
pnpm install
pnpm bootstrap
pnpm dev
```

By default:

- API: `http://127.0.0.1:3001`
- web console: `http://127.0.0.1:3000`

If you need to point the web app at a different API origin:

```bash
$env:RUNROOT_API_BASE_URL="http://127.0.0.1:3100"
pnpm --filter @runroot/web dev
```

## What The Console Shows

- `/runs`: run explorer with current status and template metadata
- `/runs/:runId`: run detail, approval snapshots, and replay summary
- `/runs/:runId/timeline`: persisted replay timeline
- `/approvals`: pending approval queue with approve, reject, and cancel actions

## Operator Actions

The console does not implement business logic itself.

It only triggers existing API routes for:

- approval decisions
- run resume

Run creation still happens through the API or CLI in this phase.
