# Changesets

Runroot uses Changesets as the input source for future release notes and
versioning once package publishing begins.

Phase 7 adds the minimum repository contract around that configuration:

- add a changeset when a change should appear in release notes
- explain in the PR when a change is intentionally release-note silent
- use the release-readiness workflow and guide to validate the repository state

See:

- [Release Readiness](../docs/guides/release-readiness.md)
- [Pull request template](../.github/pull_request_template.md)
