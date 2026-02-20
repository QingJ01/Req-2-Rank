# Release Runbook

## Publish

1. Bump package versions (`@req2rank/core`, `@req2rank/cli`).
2. Push tag `v<version>` to trigger `.github/workflows/release.yml`.
3. Workflow verifies typecheck/tests, then publishes both packages to npm.

## Rollback

Use workflow dispatch for `Release Packages`:
- set `publish=false`
- set `rollbackVersion=<known-good-version>`

The workflow updates npm `latest` dist-tag for both packages:
- `@req2rank/core@<rollbackVersion>`
- `@req2rank/cli@<rollbackVersion>`

## Guardrails

- Publishing requires `NPM_TOKEN` secret.
- Rollback does not delete versions; it only re-points dist-tags.
- Always communicate rollback in release notes and issue tracker.
