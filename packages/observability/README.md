# @runroot/observability

Owns structured logging and tracing adapter contracts.

Phase 6 responsibilities:

- expose minimal logger and tracer contracts
- provide noop and local adapters for tests and development
- keep observability separate from replay and runtime state models

The package does not define a backend or exporter strategy in this phase.
