# System Overview

Runroot is organized as a small set of deployable apps sitting on top of reusable packages.

## Layers

- `apps/api`: transport layer for run control, approval handling, and operational APIs
- `apps/web`: operator-facing console for inspecting runs and approvals
- `packages/*`: domain, runtime, persistence, events, tools, approvals, replay, and other reusable modules

## Core Architectural Rule

Apps can depend on packages. Packages must not depend on apps.

## Current Phase

In Phase 1, only the transport skeleton, workspace layout, and documentation baseline exist. Runtime behavior, storage, tool execution, and replay logic are intentionally deferred to later phases.
