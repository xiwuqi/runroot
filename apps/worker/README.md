# @runroot/worker

Minimal queued-execution worker surface for Phase 9.

This app keeps process coordination thin. It claims queued work through the
shared dispatch seam and delegates actual run execution back to the existing
runtime and template assembly packages.

Minimum local path:

```bash
RUNROOT_EXECUTION_MODE=queued pnpm --filter @runroot/worker dev
```

The worker expects database-backed persistence:

- `DATABASE_URL` for Postgres
- or `RUNROOT_PERSISTENCE_DRIVER=sqlite` with `RUNROOT_SQLITE_PATH`

The legacy JSON-file persistence path is inline-only and is not supported for
queued execution.
