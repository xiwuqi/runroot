# Good First Issues

Runroot uses good-first-issue guidance to help new contributors start with
bounded work that does not require re-learning the whole architecture first.

## What Counts As A Good First Issue

A good first issue should usually:

- touch one package or one documentation area at a time
- have a clear acceptance condition
- avoid architecture-wide refactors
- avoid later-phase product expansion
- be testable or reviewable with existing repository commands

## Good First Issue Labels

Maintainers should prefer these labels together:

- `good first issue`
- a scope label such as `docs`, `templates`, `tests`, or `tooling`
- a phase label when the repository phase materially constrains the work

## How To Claim Work

1. comment on the issue with your planned approach
2. confirm the work fits inside the active phase
3. link the docs or ADRs you used to understand the boundary
4. keep the first PR small

## What Is Usually Not A Good First Issue

- boundary changes across runtime, tools, approvals, replay, API, and web at once
- work that depends on undocumented release or deployment assumptions
- product-surface expansion disguised as cleanup
- broad refactors whose review surface is hard to contain

## Maintainer Guidance

If an issue is intended for a new contributor, write down:

- the expected file area
- the expected test or doc updates
- the main risk to avoid
- what is explicitly out of scope
