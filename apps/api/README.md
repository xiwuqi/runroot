# @runroot/api

Fastify-based operator API for Runroot.

Phase 5 routes:

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

This app is intentionally thin. It does not contain runtime state machine or persistence logic.
