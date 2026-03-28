# ADR-0009: Queue-Backed Execution And Worker Boundary

## Status

Accepted

## Context

Phase 8 established a durable persistence baseline, but execution is still
process-local. Starting or resuming a run still depends on the initiating API,
CLI, or in-process caller remaining alive long enough to drive the runtime.

Phase 9 needs to add queued execution and a minimum worker path without:

- changing runtime, approval, or replay source-of-truth semantics
- leaking queue implementation details into transport or app layers
- turning the phase into a general distributed-systems platform

## Decision

Adopt a shared dispatch queue contract in a dedicated package and route queued
execution through thin assembly layers.

### Shared dispatch contract

`@runroot/dispatch` owns:

- queued job definitions for `start_run` and `resume_run`
- claim, completion, and failure contract semantics
- vendor-neutral queue interfaces

It does not execute runs and it does not own runtime persistence.

### Persistence-backed adapters stay in `@runroot/persistence`

Queue storage lives beside the existing persistence baseline so Phase 9 can use
the same Postgres-first and SQLite-fallback stance without introducing a second
durability system.

### Worker coordination stays thin

A minimal worker surface may exist, but it must delegate to shared package
seams. Claiming queued work and invoking the runtime should happen through a
worker service that reuses:

- persistence-backed queue adapters
- the existing runtime engine
- existing template and operator assembly seams

### Replay source of truth does not change

Replay and approval views still derive from persisted runtime and approval
events. Queue bookkeeping is an execution-control concern, not a new replay
timeline source of truth.

## Consequences

### Positive

- queued execution becomes possible without redefining runtime semantics
- queue vendor details stay out of app and runtime contracts
- the worker surface can stay thin and replaceable
- Postgres and SQLite can both support the minimal Phase 9 path

### Negative

- queue bookkeeping becomes a second durable data shape to maintain
- worker crash recovery remains intentionally minimal in Phase 9
- there is still no advanced scheduling, sharding, or hosted queue story

## Rejected Alternatives

### Put queue logic directly into API and CLI layers

Rejected because it would scatter execution topology decisions across app
surfaces and make worker coordination harder to test.

### Use an external queue vendor as a hard dependency immediately

Rejected because the blueprint and handoff explicitly defer hosted queue and HA
deployment concerns.

### Redefine replay around queue state

Rejected because persisted runtime and approval events are already the accepted
source of truth for replay and audit behavior.
