# @runroot/sdk

Programmatic operator service surface for Runroot.

Phase 5 uses this package to keep API and CLI thin. The shared service:

- loads the template catalog
- validates template input
- starts and resumes workflow runs
- exposes approval and replay queries
- persists local operator state through the runtime persistence seam
