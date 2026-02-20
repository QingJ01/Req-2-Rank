# Release Runbook

## Publish

1. Bump package versions (`@req2rank/core`, `@req2rank/cli`, `req2rank`).
2. Ensure GitHub repository secret `NPM_TOKEN` is configured.
3. Push tag `v<version>` to trigger `.github/workflows/release.yml`, or use `workflow_dispatch`.
4. Workflow runs typecheck/tests, then publishes both packages to npm.

## GitHub Secret Setup

1. Go to `Settings -> Secrets and variables -> Actions`.
2. Create `NPM_TOKEN`.
3. Value should be an npm automation token with publish permission for:
   - `@req2rank/core`
   - `@req2rank/cli`
   - `req2rank`

If `NPM_TOKEN` is missing or expired, publish step will fail.

## Post-Release Verification

Run after workflow succeeds:

```bash
npm view @req2rank/core version
npm view @req2rank/cli version
npm view req2rank version
npx req2rank --help
```

Expected:

- `npm view` returns the released version.
- `npx req2rank --help` prints CLI help text without install/runtime error.

## Rollback

Use workflow dispatch for `Release Packages`:
- set `publish=false`
- set `rollbackVersion=<known-good-version>`

The workflow updates npm `latest` dist-tag for both packages:
- `@req2rank/core@<rollbackVersion>`
- `@req2rank/cli@<rollbackVersion>`
- `req2rank@<rollbackVersion>`

## Guardrails

- Publishing requires `NPM_TOKEN` secret.
- Rollback does not delete versions; it only re-points dist-tags.
- Always communicate rollback in release notes and issue tracker.
