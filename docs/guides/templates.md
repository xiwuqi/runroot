# Templates

Phase 5 ships four real workflow templates:

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

Template inputs live under [examples/phase-5](../../examples/phase-5).
