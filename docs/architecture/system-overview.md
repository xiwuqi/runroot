# System Overview

Runroot is organized as a small set of deployable apps sitting on top of reusable packages.

## Layers

- `apps/api`: transport layer for run control, approval handling, and operational APIs
- `apps/web`: operator-facing console for inspecting runs and approvals
- `packages/*`: domain, runtime, persistence, events, tools, approvals, replay, and other reusable modules

## Core Architectural Rule

Apps can depend on packages. Packages must not depend on apps.

## Current Phase

Phase 6 extends the repository from a package-first operator system to a package-first operator system with a thin web console and observability seams.

Current repository shape:

- `@runroot/domain`, `@runroot/events`, `@runroot/persistence`, and `@runroot/core-runtime` provide workflow execution primitives
- `@runroot/tools` adds the shared tool contract, registry, invocation, and permission seam
- `@runroot/mcp` adapts minimal MCP tool discovery and invocation into the shared tool contract
- `@runroot/approvals` owns approval requests, decisions, and approval-domain errors
- `@runroot/replay` projects replay timelines from persisted runtime events
- `@runroot/sdk` assembles shared operator wiring for API and CLI use
- `apps/api` exposes the thin operator transport surface
- `apps/web` visualizes runs, approvals, and replay without owning workflow logic
- `apps/*` remain thin shells and still do not own runtime or tool implementation details

Current repository rules:

- `@runroot/core-runtime` owns await-approval and resume semantics, but does not own approval storage or decision rules
- approval request and decision facts enter the shared runtime event stream
- tool invocation lifecycle hooks remain in-memory hooks inside `@runroot/tools`; they are not yet persisted replay history
- `apps/web` reads and acts through the API surface rather than directly through persistence
- `@runroot/observability` owns logging and tracing adapter seams rather than replay or event-source responsibilities
