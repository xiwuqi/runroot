# Phase 7: Open-Source Polish and Release Readiness

Status: scope frozen, execution not started

This document freezes the Phase 7 execution contract for Runroot. It expands the
high-level roadmap bullets already present in the repository into a minimal,
reviewable phase definition. It is intentionally limited to scope definition and
handoff guidance. It does not authorize implementation by itself.

## Why Now

Phases 2 through 6 established the runtime, tool layer, approvals, replay,
operator surfaces, and the minimal web console. Phase 7 exists to make that
existing system maintainable and approachable for outside contributors and early
users.

This phase belongs here because the repository now has enough real surfaces to
document, release, and open for contribution. These tasks should happen before
any broader product expansion, but after the core architecture is stable enough
that contributor guidance and release mechanics will not churn immediately.

## Formal Name

Primary name:

- `Open-Source Polish and Release Readiness`

Short label:

- `Open-Source Polish`

Rules:

- Use the primary name in formal phase definitions, ADRs, and execution prompts.
- The short label may appear in roadmap summaries where brevity helps, but it is
  an alias, not a separate phase.

## Formal Goals

Phase 7 focuses on repository readiness for external contributors and the first
repeatable release flow.

Goals:

1. tighten contributor-facing documentation so a new contributor can discover
   the project scope, local setup, architecture boundaries, testing
   expectations, and contribution flow without relying on prior conversation
   context
2. polish examples and template-facing guidance so the current workflow surface
   is easier to evaluate and extend
3. add repository contribution assets required for public collaboration,
   including issue templates, a pull request template, and explicit good-first-
   issue guidance
4. define and land the minimum release-readiness workflow for this repository,
   including release workflow mechanics and changelog/release note strategy
5. complete the architecture and roadmap documentation set so future phase
   execution starts from repository state instead of chat history

## Formal Acceptance Standards

Phase 7 is complete only when all of the following are true:

1. contributor-facing documentation is coherent and cross-linked:
   `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`,
   `docs/roadmap.md`, and the relevant architecture docs all point to the
   current repository surfaces
2. the first-pass public contribution assets exist and are usable:
   issue templates, pull request template, and good-first-issue guidance are
   present in the repository
3. examples and template guides are polished enough that a contributor can use
   them to understand the supported workflows without reading source first
4. release-readiness mechanics are present and documented:
   the repository contains an explicit release workflow and a documented
   changelog/release-note strategy
5. architecture documentation is complete enough to support future phases
   without relying on non-repository handoff context
6. all changed docs and repository-process files use the frozen Phase 7 naming
   consistently
7. lint passes
8. typecheck passes if any code-adjacent changes require it
9. tests pass if any docs or workflow assets touch tested surfaces
10. integration tests pass if any release or repository automation changes
    affect checked flows
11. build passes if any repository configuration changes affect buildable
    workspaces
12. the phase does not introduce new runtime, tool, approval, replay, API, or
    web product behavior
13. no Phase 8 or later scope is pulled into the implementation

## Formal Non-Goals

Phase 7 does not include:

1. new runtime, tool, approval, replay, API, CLI, or web console features
2. a docs-site rebuild or a new documentation platform unless the existing docs
   structure cannot satisfy contributor onboarding requirements
3. observability backend integrations, dashboard expansion, or productized admin
   experiences
4. auth, RBAC, multi-tenant, billing, or SaaS concerns
5. marketplace or plugin-registry product work
6. large architectural refactors disguised as polish
7. Phase 8 release expansion or post-release feature work

## Recommended Monorepo Impact Range

Phase 7 should stay primarily inside documentation and repository process files.

Expected high-signal areas:

- `README.md`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `docs/roadmap.md`
- `docs/architecture/*`
- `docs/guides/*`
- `examples/*`
- `.github/ISSUE_TEMPLATE/*`
- `.github/pull_request_template.md`
- `.github/workflows/*` for release-readiness only
- release metadata already present in the repository, such as Changesets config
  or changelog strategy docs

Default non-targets:

- `apps/*`
- `packages/*`

These should only change if a repository-readiness asset genuinely cannot be
completed without a minimal supporting update, and that reason must be documented
in the implementation phase.

## Preconditions

Phase 7 execution assumes:

1. Phases 2 through 6 are merged into `main`
2. there are no remaining stacked PR dependencies
3. the repository can pass its baseline quality commands before Phase 7 starts
4. the current public surfaces are stable enough that contributor and release
   docs will not immediately become inaccurate

Current repository status at freeze time:

- these preconditions are satisfied

## Primary Architecture Risks

The main risks in Phase 7 are process and boundary risks rather than runtime
risks.

1. treating polish work as justification to expand product scope
2. letting repository workflow changes silently reshape architecture ownership,
   for example by moving business logic into scripts or CI shortcuts
3. overcommitting to a docs site or release system that exceeds the current
   project maturity
4. making release workflows look complete while still depending on undocumented
   manual steps

## Must Be Deferred

The following remain out of scope after Phase 7:

1. Phase 8 or later feature expansion
2. major observability platform work
3. new operator product surfaces
4. large deployment-matrix or SaaS concerns
5. broad ecosystem/plugin-marketplace work
6. aggressive branding or marketing-site work unrelated to contributor
   onboarding and release readiness

## Recommended Branch Name Slug

When implementation begins, use:

- `wuxi/phase-7-open-source-polish-release-readiness`

This scope-freeze branch is intentionally separate and should not be reused for
the implementation phase.

## Recommended Commit Slicing

If Phase 7 implementation proceeds, prefer small reviewable slices:

1. docs and naming consistency
2. contributor onboarding and examples polish
3. issue templates, PR template, and good-first-issue guidance
4. release workflow and changelog/release-note strategy
5. final docs polish and validation

## Recommended PR Strategy

Phase 7 should use direct-to-main PRs from the latest `main`.

Preferred strategy:

- one primary PR if the repository-process changes remain tightly scoped
- split into two PRs only if release workflow changes are large enough to
  justify separate review from docs/contributor assets

Do not use stacked PRs for Phase 7 unless an unexpected blocker appears and is
documented first.

## Relationship To Phase 6

Phase 6 made the repository operationally demonstrable through the web console
and observability seams. Phase 7 does not extend those surfaces. Instead, it
packages the existing repository into a form that outside contributors can
understand, run, review, and release.

## Why This Is Phase 7 And Not A Later Phase

These tasks belong in Phase 7 because they are required to make the existing
project sustainably open-source. They do not require new product behavior, but
they do require the architecture to be stable enough that repository guidance
and release processes will hold. That is true now in a way that was not true in
earlier phases.

## Start Gate For The Execution Phase

Before the Phase 7 execution branch is created, re-check:

1. `main` is synced to `origin/main`
2. no open stacked PRs remain
3. working tree is clean
4. the frozen Phase 7 naming is consistent in `AGENTS.md`, `docs/roadmap.md`,
   and this handoff document
5. the implementation plan still fits inside the non-goals above
