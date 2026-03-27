# ADR-0003: Postgres First With SQLite Development Fallback

## Status

Accepted

## Context

Runroot needs durable state, event history, and future replay support. The main deployment target is a self-hosted team environment where Postgres is a reasonable default. Local development still benefits from a lighter-weight option.

## Decision

Design persistence contracts around Postgres as the primary backing store. Allow SQLite as a local-development fallback adapter, provided it conforms to the same repository contracts where practical.

## Consequences

Positive:

- aligns with the durability and audit goals of the project
- keeps local setup lightweight when full Postgres is unnecessary
- avoids committing early to external queue infrastructure

Negative:

- SQLite compatibility may constrain some SQL features
- dual-adapter testing will be needed in later phases

## Revisit Trigger

Revisit if SQLite creates too much divergence from the production data model.
