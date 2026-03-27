# Quickstart

Runroot now ships the first complete repository baseline for:

- the operator API
- the operator CLI
- the workflow template catalog
- the minimal web console
- contributor-facing docs and examples

## 1. Install And Bootstrap

```bash
pnpm install
pnpm bootstrap
```

## 2. Start The API

```bash
$env:RUNROOT_WORKSPACE_PATH=".runroot/workspace.json"
pnpm --filter @runroot/api dev
```

The API keeps state in a local JSON workspace file for the current local-development path.

## 3. Start The Web Console

```bash
$env:RUNROOT_API_BASE_URL="http://127.0.0.1:3001"
pnpm --filter @runroot/web dev
```

Then open `http://127.0.0.1:3000/runs`.

## 4. Start A Workflow Through The CLI

```bash
pnpm --filter @runroot/cli dev templates list
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
```

## 5. Run An Approval Workflow

```bash
pnpm --filter @runroot/cli dev runs start slack-approval-flow --input-file examples/phase-5/slack-approval.json
pnpm --filter @runroot/cli dev approvals pending
pnpm --filter @runroot/cli dev approvals decide approval_1 --decision approved --actor ops-oncall
pnpm --filter @runroot/cli dev runs resume run_1
```

## 6. Inspect Replay

```bash
pnpm --filter @runroot/cli dev runs timeline run_1
```

You can inspect the same run through:

- `GET /runs/:runId`
- `GET /runs/:runId/timeline`
- the web console run detail and timeline pages

For route and payload details, see:

- [API Usage](./api-usage.md)
- [CLI Usage](./cli-usage.md)
- [Templates](./templates.md)
- [Web Console](./web-console.md)
- [Examples](../../examples/README.md)
- [Contributor Onboarding](./contributor-onboarding.md)
