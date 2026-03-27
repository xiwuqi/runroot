# Observability

Phase 6 introduces observability as adapter seams, not as a new runtime center.

## Goal

Provide minimal logging and tracing hooks that app and package code can depend on without locking Runroot into a specific backend.

## Phase 6 Scope

- structured logger contract
- tracer contract with lightweight span semantics
- noop adapters for safe defaults
- simple local adapters for tests and development

## Non-Goals

- full OpenTelemetry deployment model
- trace storage backends
- metrics platform
- replay replacement

## Relationship To Replay

Replay is still derived from persisted runtime and approval events.

Observability is complementary:

- replay explains what durable workflow facts happened
- logging and tracing explain how the current app and operator surfaces interacted while serving those facts

Tool hooks remain separate:

- tool lifecycle hooks continue to be in-memory seams in `@runroot/tools`
- they are not automatically promoted into persisted replay history in Phase 6
