# @runroot/dispatch

Owns the shared queue and dispatch contracts for queued execution.

Phase 9 exports:

- a vendor-neutral dispatch queue contract
- queue job definitions for start and resume commands
- an in-memory reference queue for tests and local boundary checks

The dispatch package does not execute runs. It only models queued work and the
minimum claim and completion lifecycle needed to hand work to a worker.

Database-backed queue adapters live in `@runroot/persistence`. The dispatch
package intentionally stays vendor-neutral and transport-free.
