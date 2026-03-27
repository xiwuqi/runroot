# Templates

Runroot currently ships four workflow templates. They are reference workflows,
not app-specific demos, and they are meant to show how runtime orchestration,
tools, approvals, and replay fit together.

## Template Boundaries

- Templates live in `packages/templates`
- Input payload examples live in [`examples/phase-5`](../../examples/phase-5)
- Templates must go through the shared runtime, tool, approval, and replay seams
- Templates are not allowed to bypass persistence or hide operator actions in UI-only code

## Current Catalog

| Template | Example Input | Tools / Integrations | Approval Behavior | Replay Notes |
| --- | --- | --- | --- | --- |
| `github-issue-triage` | [`github-issue-triage.json`](../../examples/phase-5/github-issue-triage.json) | MCP-backed GitHub issue analysis | Optional approval for risky issues | Produces a triage summary and approval transitions |
| `pr-review-flow` | [`pr-review-flow.json`](../../examples/phase-5/pr-review-flow.json) | MCP-backed PR review analysis | No approval by default | Produces replayable review output |
| `slack-approval-flow` | [`slack-approval.json`](../../examples/phase-5/slack-approval.json) | Local Slack-style notification tool | Waits for explicit approval and explicit resume | Shows approval-requested, approval-decided, and resume events |
| `shell-runbook-flow` | [`shell-runbook.json`](../../examples/phase-5/shell-runbook.json) | Local allowlisted shell tool | Optional approval gate | Produces replayable shell execution output |

## `github-issue-triage`

- Uses MCP-backed GitHub issue analysis
- Requests approval when the issue looks high risk
- Produces a replayable triage summary

## `pr-review-flow`

- Uses MCP-backed PR review analysis
- Produces a structured review summary
- Does not require approval by default

## `slack-approval-flow`

- Sends a Slack-style notification through a local tool
- Waits for operator approval
- Requires explicit `resumeRun(...)` after approval

## `shell-runbook-flow`

- Runs a local allowlisted shell command
- Supports an optional approval gate
- Produces replayable shell execution output

For a contributor-facing explanation of the example inputs, see [examples/README.md](../../examples/README.md) and [examples/phase-5/README.md](../../examples/phase-5/README.md).
