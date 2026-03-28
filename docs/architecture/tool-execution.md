# Tool Execution

Runroot executes tools through a shared contract that keeps runtime orchestration separate from concrete integrations.

## Phase 3 Responsibilities

- `@runroot/tools`
  - defines the shared tool contract
  - owns registration, lookup, invocation, validation, and permission gates
  - exposes lifecycle hooks for future audit, replay, and approval integration
- `@runroot/mcp`
  - translates a minimal MCP client contract into internal tool definitions
  - keeps MCP naming and invocation details out of `@runroot/core-runtime`

## Tool Contract

Each tool definition exposes:

- stable metadata: `id`, `name`, `description`, `source`
- `inputSchema`
- `output` contract
- optional `tags` and `capabilities`
- an implementation that accepts normalized invocation context

The current schema system is intentionally small. It supports the validation needed for tool inputs and basic output contracts without committing the repository to a heavyweight policy or schema engine.

## Runtime Boundary

`@runroot/core-runtime` does not know about concrete tools or MCP clients.

Runtime steps receive a `ToolInvoker` on step context. That invoker is the only tool-facing runtime dependency in Phase 3.

This keeps the boundary clear:

- runtime owns orchestration and state transitions
- tools own external capability access
- MCP is one tool provider, not a parallel runtime system

Phase 10 adds one more rule: durable tool history stays additive to runtime
state. Tool invocation outcomes may be persisted for audit and telemetry, but
they do not redefine replay, approval, or run-state source of truth.

## Invocation Flow

1. runtime or another caller builds a `ToolInvocationRequest`
2. `ToolInvoker` resolves the tool from the registry
3. the invoker validates input against the tool schema
4. the permission gate decides whether the call is allowed
5. the tool implementation executes and returns normalized output
6. invocation hooks receive started, blocked, succeeded, or failed callbacks

Phase 3 does not persist tool invocation events into the shared runtime event store. It only establishes the hook points needed for later audit and replay work.

Phase 10 turns those hook points into a shared persisted tool-history seam. The
persisted history is intentionally scoped:

- keep stable correlation facts such as run, step, dispatch job, worker, and
  tool identifiers
- keep generic input and output summaries
- avoid provider-specific raw payload persistence by default
- stay queryable through existing operator surfaces rather than a new telemetry
  service layer

Persisted tool history is not part of the replay event stream. Replay still
derives only from persisted runtime and approval events.

## Minimal MCP Scope

Phase 3 MCP support is intentionally narrow:

- discover tools from a client that can list tool descriptors
- call an MCP tool through a single `callTool` method
- map MCP descriptors into internal tool definitions

Phase 3 does not cover prompts, resources, streaming transports, server lifecycle orchestration, or multi-transport negotiation.
