# API Usage

Phase 5 exposes a thin Fastify operator surface.

## Routes

- `GET /healthz`
- `GET /manifest/project`
- `GET /manifest/packages`
- `GET /templates`
- `GET /runs`
- `POST /runs`
- `GET /runs/:runId`
- `GET /runs/:runId/approvals`
- `POST /runs/:runId/resume`
- `GET /runs/:runId/timeline`
- `GET /approvals/pending`
- `GET /approvals/:approvalId`
- `POST /approvals/:approvalId/decision`

## Start A Run

```bash
curl -X POST http://127.0.0.1:3001/runs ^
  -H "content-type: application/json" ^
  -d "{\"templateId\":\"shell-runbook-flow\",\"input\":{\"runbookId\":\"node-health-check\",\"commandAlias\":\"print-ready\",\"approvalRequired\":false}}"
```

## Decide An Approval

```bash
curl -X POST http://127.0.0.1:3001/approvals/approval_1/decision ^
  -H "content-type: application/json" ^
  -d "{\"decision\":\"approved\",\"actorId\":\"ops-oncall\"}"
```

## Resume A Run

```bash
curl -X POST http://127.0.0.1:3001/runs/run_1/resume
```

## Query Replay Timeline

```bash
curl http://127.0.0.1:3001/runs/run_1/timeline
```

The API does not implement workflow logic itself. It delegates to the shared operator service in `@runroot/sdk`.
