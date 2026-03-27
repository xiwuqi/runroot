# ADR-0008: Web Console And Observability Boundaries

## Status

Accepted

## Context

Phase 5 introduced thin API and CLI surfaces plus a shared operator service. Phase 6 needs to add a usable web console and basic observability seams without turning either concern into a second orchestration stack.

The repository already has stable package-level seams for:

- workflow execution in `@runroot/core-runtime`
- approvals in `@runroot/approvals`
- replay projection in `@runroot/replay`
- operator assembly in `@runroot/sdk`
- transport in `apps/api`

The web console must reuse those seams. It must not reimplement run control, approval logic, or replay projection in React components or Next.js route handlers.

Phase 6 also introduces observability. Logging and tracing need a home, but they should begin as adapter contracts rather than a vendor-bound platform layer.

## Decision

### Web console stays thin

`apps/web` is a presentation and operator-entry app only.

It may:

- read run, approval, and timeline data through existing API routes
- trigger resume and approval decisions through existing operator routes
- provide loading, empty, and error states for those views

It must not:

- access persistence adapters directly
- project replay timelines itself from raw event stores
- assemble a second workflow or approval service layer in the app

### API remains the only business entrypoint for the web app

The web console talks to `apps/api` through existing routes or narrow route additions only when the current Phase 6 screens require them.

The API remains responsible for request mapping and response mapping. Business logic still belongs to reusable packages and the shared operator service.

### Observability starts as adapter seams

`@runroot/observability` owns minimal logging and tracing contracts plus noop or local adapters.

Phase 6 observability may:

- wrap API and web-side operations in trace spans
- capture structured log events around page data fetches and operator actions
- provide an integration point for later OpenTelemetry-style implementations

It must not:

- become a second event store
- redefine replay semantics
- require a specific backend vendor or deployment model

### Persisted replay events remain separate from tool hooks

Replay views in the web console continue to use persisted runtime and approval events as the source of truth.

Tool lifecycle hooks remain in-memory hook seams from `@runroot/tools`. Phase 6 does not persist them for the sake of easier UI rendering.

## Consequences

### Positive

- web UI stays easy to replace and reason about
- replay semantics remain consistent with Phase 4
- observability can grow later without forcing a runtime redesign
- contributors can work on web views, API transport, and core packages independently

### Negative

- the first web console is intentionally narrow
- tool-level observability in the UI remains limited until a later phase proves which tool facts belong in persisted history
- some data shaping must happen twice: once in API responses, once in UI presentation

## Rejected Alternatives

### Build a web-only operator service

Rejected because it would duplicate the API and package-level seams introduced in Phase 5 and quickly create drift.

### Persist every tool lifecycle hook for UI completeness

Rejected because the project has not yet proven that every hook belongs in the replay source of truth. Doing so now would overfreeze the model.

### Introduce full OpenTelemetry plumbing in Phase 6

Rejected because the phase needs a stable seam first, not a heavyweight backend commitment.
