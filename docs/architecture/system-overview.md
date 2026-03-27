# System Overview

Runroot is organized as a small set of deployable apps sitting on top of reusable packages.

## Layers

- `apps/api`: transport layer for run control, approval handling, and operational APIs
- `apps/web`: operator-facing console for inspecting runs and approvals
- `packages/*`: domain, runtime, persistence, events, tools, approvals, replay, and other reusable modules

## Core Architectural Rule

Apps can depend on packages. Packages must not depend on apps.

## Current Phase

Phase 4 extends the repository from a runtime-only baseline to a runtime + tool + approval/replay baseline.

Current repository shape:

- `@runroot/domain`, `@runroot/events`, `@runroot/persistence`, and `@runroot/core-runtime` provide workflow execution primitives
- `@runroot/tools` adds the shared tool contract, registry, invocation, and permission seam
- `@runroot/mcp` adapts minimal MCP tool discovery and invocation into the shared tool contract
- `@runroot/approvals` owns approval requests, decisions, and approval-domain errors
- `@runroot/replay` projects replay timelines from persisted runtime events
- `apps/*` remain thin shells and still do not own runtime or tool implementation details

Current repository rules:

- `@runroot/core-runtime` owns await-approval and resume semantics, but does not own approval storage or decision rules
- approval request and decision facts enter the shared runtime event stream
- tool invocation lifecycle hooks remain in-memory hooks inside `@runroot/tools`; they are not yet persisted replay history
- UI and operator surfaces beyond package-level APIs remain deferred to later phases
