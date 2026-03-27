# @runroot/web

Minimal Next.js operator console for Runroot.

Phase 6 responsibilities:

- render runs list and run detail views
- surface pending approvals and minimal operator actions
- visualize replay timeline data from the API
- stay thin by delegating all workflow logic to API/operator seams

The web app must not access persistence directly or assemble a second workflow service layer.
