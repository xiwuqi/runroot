# ADR-0001: Monorepo And Foundation Stack

## Status

Accepted

## Context

Runroot needs to start as a small-team project while preserving package boundaries suitable for future open-source contributors. The project must support apps, shared packages, docs, tests, and future releases without creating avoidable operational complexity.

## Decision

Use a pnpm workspace monorepo with:

- TypeScript strict mode
- Node.js 20 LTS baseline
- Fastify for the API app
- Next.js for the web console
- Biome for lint and format
- Vitest for unit and integration tests
- tsup for package and API builds
- Changesets for release management

Do not introduce Turborepo in Phase 1.

## Consequences

Positive:

- low setup overhead
- explicit package boundaries
- consistent quality gates across apps and packages
- easy future adoption of release tooling

Negative:

- recursive scripts are less optimized than a specialized build orchestrator
- Next.js adds some build weight even for a minimal console

## Revisit Trigger

Revisit if workspace size or build times justify a dedicated task orchestrator.
