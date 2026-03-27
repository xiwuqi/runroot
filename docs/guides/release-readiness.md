# Release Readiness

Phase 7 introduces the minimum release-readiness flow for Runroot. This is not a
full release platform. It is the smallest repeatable path that makes release
intent, changelog inputs, and validation visible in the repository.

## Current Strategy

Runroot uses Changesets as the source input for future release notes.

- repository-facing or user-facing changes that should appear in release notes
  should add a changeset
- purely local refactors or internal cleanup can skip a changeset, but the PR
  should explain why
- the release-readiness workflow validates the repository baseline and summarizes
  whether changeset files exist

See [`.changeset/README.md`](../../.changeset/README.md) for the maintainer note
that accompanies this strategy.

## Release Workflow

The repository includes a manual GitHub Actions workflow:

- [`.github/workflows/release-readiness.yml`](../../.github/workflows/release-readiness.yml)

It is intentionally minimal. It:

1. checks out the repository
2. runs the standard quality baseline
3. summarizes whether release-note inputs exist in `.changeset/`
4. points maintainers back to this guide for the manual follow-through

## Manual Release Checklist

Before calling a release ready:

1. ensure the main branch is green
2. confirm contributor-facing docs match the repository state
3. confirm examples and template guides still match the current workflows
4. confirm release-note-worthy changes have changesets or an explicit PR note
5. run the release-readiness workflow and inspect its summary

## What This Does Not Do Yet

- it does not publish packages automatically
- it does not create a docs site
- it does not manage vendor-specific release backends
- it does not replace human release review
