# Quickstart

Phase 5 ships the first operator-facing API, CLI, and workflow templates.

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

The API keeps state in a local JSON workspace file for Phase 5.

## 3. Start A Workflow Through The CLI

```bash
pnpm --filter @runroot/cli dev templates list
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
```

## 4. Run An Approval Workflow

```bash
pnpm --filter @runroot/cli dev runs start slack-approval-flow --input-file examples/phase-5/slack-approval.json
pnpm --filter @runroot/cli dev approvals pending
pnpm --filter @runroot/cli dev approvals decide approval_1 --decision approved --actor ops-oncall
pnpm --filter @runroot/cli dev runs resume run_1
```

## 5. Inspect Replay

```bash
pnpm --filter @runroot/cli dev runs timeline run_1
```

For route and payload details, see:

- [API Usage](./api-usage.md)
- [CLI Usage](./cli-usage.md)
- [Templates](./templates.md)
