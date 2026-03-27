# ADR-0002: Domain Boundaries And Package Layout

## Status

Accepted

## Context

Runroot must avoid turning the API or web app into the de facto runtime implementation. The project also needs clear seams for future contributions around tools, approvals, replay, persistence, and observability.

## Decision

Adopt a package layout that separates:

- `domain`
- `core-runtime`
- `persistence`
- `events`
- `tools`
- `mcp`
- `approvals`
- `replay`
- `observability`
- `sdk`
- `cli`
- `templates`
- `config`
- `test-utils`

Apps remain thin. Runtime logic must live in packages, not in transport or presentation layers.

## Consequences

Positive:

- contributor-friendly module boundaries
- easier testing and future plugin seams
- lower risk of framework-specific leakage into runtime code

Negative:

- more packages exist before they contain substantial implementation
- contributors must learn package responsibilities early

## Revisit Trigger

Revisit if multiple packages remain permanently empty after Phase 3 and can be safely merged without losing a real boundary.
