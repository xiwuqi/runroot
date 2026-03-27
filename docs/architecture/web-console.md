# Web Console

The Phase 6 web console is an operator-facing visualization layer for the capabilities already exposed through Runroot's API and package seams.

## Scope

Phase 6 adds:

- runs list
- run detail
- approval queue
- timeline and replay view
- minimal operator actions for approval decisions and run resume

Phase 6 does not add:

- workflow editing
- product-style dashboards
- alternate workflow execution logic in the browser

## Data Surface

The web app reads and acts through API routes.

Primary queries:

- `GET /runs`
- `GET /runs/:runId`
- `GET /runs/:runId/approvals`
- `GET /runs/:runId/timeline`
- `GET /approvals/pending`
- `GET /approvals/:approvalId`

Primary mutations:

- `POST /approvals/:approvalId/decision`
- `POST /runs/:runId/resume`

## Boundary Rules

- the web app does not talk to persistence adapters directly
- the web app does not run replay projection logic itself
- operator actions remain API-backed
- UI components may format data, but they do not own approval or workflow state transitions

## Minimal UX Direction

The console should optimize for clarity and debugging speed:

- readable status badges
- obvious empty and error states
- a direct path from pending approval to approval decision
- timeline entries grouped as plain operational facts rather than product analytics
