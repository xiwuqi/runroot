# Phase 5 Workflow Inputs

These files are input payloads for the workflow templates shipped in Phase 5.

Use them to exercise the current operator surfaces without inventing new
workflow contracts.

## Files

- [`github-issue-triage.json`](./github-issue-triage.json): sample input for the GitHub issue triage workflow
- [`pr-review-flow.json`](./pr-review-flow.json): sample input for the PR review workflow
- [`slack-approval.json`](./slack-approval.json): sample input for the approval-driven Slack notification workflow
- [`shell-runbook.json`](./shell-runbook.json): sample input for the shell runbook workflow

## How To Run

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
pnpm --filter @runroot/cli dev runs start pr-review-flow --input-file examples/phase-5/pr-review-flow.json
```

Approval-oriented examples can then be continued through:

```bash
pnpm --filter @runroot/cli dev approvals pending
pnpm --filter @runroot/cli dev approvals decide approval_1 --decision approved --actor ops-oncall
pnpm --filter @runroot/cli dev runs resume run_1
```

These files are reference inputs only. They are not treated as a separate
template system and should stay aligned with the templates in
`packages/templates`.
