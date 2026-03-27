# Extension Model

Runroot is intended to grow through clear extension seams rather than ad hoc hooks.

Current extension seams:

- tool providers
- MCP adapters
- persistence adapters
- observability adapters
- workflow templates

Each extension point should remain testable and documented, with a narrow public contract.

Phase 3 defines the first concrete provider seam:

- local tools register directly through `@runroot/tools`
- MCP-backed tools enter through `@runroot/mcp`
- runtime consumes only the shared `ToolInvoker` contract

Approval adapters, replay projections, and richer policy engines are intentionally deferred until later phases force those contracts to stabilize.
