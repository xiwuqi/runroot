# System Overview

Runroot is organized as a small set of deployable apps sitting on top of reusable packages.

## Layers

- `apps/api`: transport layer for run control, approval handling, and operational APIs
- `apps/web`: operator-facing console for inspecting runs and approvals
- `packages/*`: domain, runtime, persistence, events, tools, approvals, replay, and other reusable modules

## Core Architectural Rule

Apps can depend on packages. Packages must not depend on apps.

## Current Phase

Phase 3 extends the repository from a runtime-only baseline to a runtime plus tool layer baseline.

Current repository shape:

- `@runroot/domain`, `@runroot/events`, `@runroot/persistence`, and `@runroot/core-runtime` provide workflow execution primitives
- `@runroot/tools` adds the shared tool contract, registry, invocation, and permission seam
- `@runroot/mcp` adapts minimal MCP tool discovery and invocation into the shared tool contract
- `apps/*` remain thin shells and still do not own runtime or tool implementation details

Approval workflows, replay views, and operator-facing tool management remain deferred to later phases.
