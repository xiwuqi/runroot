# @runroot/api

Fastify-based operator API for Runroot.

Phase 1 routes:

- `GET /healthz`: process health and current phase
- `GET /manifest/project`: project metadata and required quality commands
- `GET /manifest/packages`: package boundary manifest used to keep architecture visible

This app is intentionally thin. It does not contain runtime state machine or persistence logic.
