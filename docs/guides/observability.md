# Observability Foundations

Phase 6 introduces minimal observability seams without changing replay semantics.

## What Exists

- `@runroot/observability` logger contract
- `@runroot/observability` tracer contract
- noop adapters for safe defaults
- local memory adapters for tests

## What Does Not Exist Yet

- OpenTelemetry exporter wiring
- metrics backend
- observability UI platform
- persisted tool-hook history

## Current Boundary

- replay timeline still comes from persisted runtime and approval events
- tool lifecycle hooks remain in-memory hooks inside `@runroot/tools`
- observability adapters are for request tracing and structured logging, not for replacing replay
