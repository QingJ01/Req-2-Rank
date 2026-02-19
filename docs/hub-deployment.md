# Hub Deployment Guide

## Environment

- `R2R_HUB_TOKEN`: Bearer token used by CLI and Hub API.
- `R2R_DATABASE_URL`: PostgreSQL connection string.
- `R2R_GITHUB_OAUTH`: Set `true` to enable GitHub OAuth token exchange.
- `R2R_GITHUB_CLIENT_ID`: GitHub OAuth app client id.
- `R2R_GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret.
- `R2R_REVERIFY_SECRET`: Secret header for async reverification processor.

## Local Run

1. Copy `packages/hub/.env.example` to `.env`.
2. Set `R2R_HUB_TOKEN` to a secure value.
3. Run `pnpm --filter @req2rank/hub db:migrate` to create tables.
4. Run `pnpm --filter @req2rank/hub test` to verify routes.
5. Start worker trigger by calling `/api/reverification/process` with `x-reverify-secret`.

## Production Checklist

1. Configure `R2R_HUB_TOKEN` in deployment platform secret storage.
2. Configure PostgreSQL URL and network access.
3. Run `pnpm --filter @req2rank/hub db:migrate` on release.
4. Run `pnpm typecheck && pnpm test` before deploy.
5. Expose `/api/nonce`, `/api/submit`, `/api/leaderboard`, `/api/model/:id`, `/api/submission/:id`, and `/api/flag`.
6. Configure a scheduler to call `/api/reverification/process` periodically.
