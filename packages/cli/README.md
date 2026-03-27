# @runroot/cli

Operator-facing command line interface for local Runroot workflows.

Phase 5 ships:

- `templates list`
- `runs start`
- `runs show`
- `runs resume`
- `runs timeline`
- `approvals pending`
- `approvals show`
- `approvals decide`

Example:

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
```
