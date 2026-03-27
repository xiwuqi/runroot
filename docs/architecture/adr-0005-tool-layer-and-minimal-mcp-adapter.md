# ADR-0005: Tool Layer And Minimal MCP Adapter

## Status

Accepted

## Context

Phase 2 established Runroot's runtime core, event model, checkpoints, and an atomic persistence boundary. Phase 3 needs to add tool execution without undoing those boundaries.

Runroot must support:

- local and built-in tools
- MCP-backed tools
- clear permission gates before side effects expand in later phases
- future replay, approval, and audit hooks around tool calls

Runroot does not need a full plugin marketplace, policy engine, or complete MCP transport matrix in this phase.

## Decision

Introduce a dedicated tool layer in `@runroot/tools` and keep MCP-specific translation in `@runroot/mcp`.

Phase 3 implements:

- a shared `ToolDefinition` contract with metadata, input schema, and output contract
- a `ToolRegistry` responsible for registration and lookup only
- a `ToolInvoker` abstraction that resolves tools, validates input, applies permission gates, and emits invocation lifecycle hooks
- a minimal allowlist-based `ToolPermissionGate`
- a minimal MCP adapter that maps `listTools` and `callTool` from an MCP client contract into internal tool definitions
- runtime integration only through the shared `ToolInvoker` seam exposed on step context

Phase 3 does not implement:

- approval workflows around tool calls
- replay UIs for tool activity
- sandboxing or policy engines
- complete MCP protocol coverage beyond tool discovery and tool invocation

## Consequences

Positive:

- runtime stays decoupled from concrete GitHub, Slack, shell, HTTP, or MCP implementations
- local tools and MCP-backed tools share one registry and invocation contract
- approval and replay work in later phases can attach to invocation hooks instead of patching runtime internals
- future persistence adapters do not need MCP-specific knowledge

Negative:

- tool metadata and invocation error names become a compatibility surface earlier
- the initial schema validator is intentionally minimal and may need to expand later
- MCP support is intentionally partial until real transports and approval constraints justify more surface area

## Revisit Trigger

Revisit if:

- tool result normalization proves too limited for real workflow templates
- MCP integrations need transport-specific lifecycle management
- approval or replay requirements need tool invocation events promoted into the shared event package
