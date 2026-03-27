# CLI Usage

Phase 5 CLI commands are intentionally simple and JSON-first.

## List Templates

```bash
pnpm --filter @runroot/cli dev templates list
```

## Start A Run

```bash
pnpm --filter @runroot/cli dev runs start shell-runbook-flow --input-file examples/phase-5/shell-runbook.json
```

## Show Run State

```bash
pnpm --filter @runroot/cli dev runs show run_1
```

## List Pending Approvals

```bash
pnpm --filter @runroot/cli dev approvals pending
```

## Record A Decision

```bash
pnpm --filter @runroot/cli dev approvals decide approval_1 --decision approved --actor ops-oncall
```

## Resume A Run

```bash
pnpm --filter @runroot/cli dev runs resume run_1
```

## Replay Summary

```bash
pnpm --filter @runroot/cli dev runs timeline run_1
```

Use `--workspace <path>` to point commands at a different local workspace file.
