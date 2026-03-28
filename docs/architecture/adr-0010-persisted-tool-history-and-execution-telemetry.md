# ADR-0010: Persisted Tool History And Execution Telemetry Boundaries

## Status

Accepted

## Context

Phase 3 introduced tool invocation hooks inside `@runroot/tools`, but those hooks
only produced in-memory lifecycle callbacks. Phase 6 introduced logging and
tracing adapter seams, but observability still stopped at process boundaries.
Phase 9 then moved execution across queue and worker seams, which made the lack
of durable tool history and cross-process correlation more visible.

Runroot now needs a minimal persisted tool-history path and a minimal telemetry
correlation strategy. That work must remain additive:

- replay and approval still derive only from persisted runtime and approval
  events
- tool history cannot become a second source of truth for workflow state
- queue, worker, and provider details cannot leak into runtime domain models or
  app surfaces

## Decision

Phase 10 adds a shared, additive tool-history seam plus thin telemetry
correlation wiring.

1. `@runroot/tools` owns the shared tool-history contract.
   - The contract records scoped invocation outcomes, correlation identifiers,
     and generic summaries.
   - The contract does not persist provider-specific raw payloads by default.
2. `@runroot/persistence` owns concrete tool-history storage adapters.
   - Postgres and SQLite persist tool-history rows beside the existing
     persistence baseline.
   - The legacy file path gets a compatibility sidecar so inline execution can
     still persist tool outcomes without changing runtime event storage.
3. `@runroot/sdk` owns the thin operator and worker wiring.
   - Operator and worker services attach telemetry observers to the shared tool
     invoker seam.
   - Tool-history reads are exposed through existing operator surfaces rather
     than a new service stack.
4. `@runroot/observability` remains an adapter boundary.
   - Logger and tracer adapters receive correlation attributes for run, step,
     dispatch job, worker, and tool identifiers.
   - This phase does not add a vendor backend, metrics platform, or dashboard
     product surface.
5. Replay remains unchanged.
   - `@runroot/replay` continues to read persisted runtime and approval events.
   - Tool history is queryable audit data, not replay input.

## Consequences

### Positive

- inline and queued execution can both produce durable, queryable tool-history
  records
- operator surfaces can show minimal tool execution facts without redefining the
  replay model
- logs and traces can correlate cross-process execution using the same durable
  identifiers
- later phases can extend audit and observability paths without redesigning the
  runtime core

### Negative

- tool telemetry now spans tools, persistence, SDK wiring, and thin API/web read
  paths
- file-backed compatibility requires a small sidecar persistence path in
  addition to the workspace snapshot
- telemetry correlation needs disciplined tests so it does not silently diverge
  between inline and queued execution

## Non-Goals

This ADR does not introduce:

- full observability backend integration
- metrics, alerts, or log shipping platforms
- productized dashboards or analytics suites
- replay reconstruction from tool-history rows
- persistence of every provider-specific request or response payload
- advanced distributed scheduling or worker orchestration features
