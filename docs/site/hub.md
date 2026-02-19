# Hub APIs and Pages

This page documents currently available Hub endpoints and web entry pages.

## Public API Endpoints

- `GET /api/public/leaderboard`
- `GET /api/public/model/:id`

## Authenticated Hub Endpoints

- `POST /api/nonce`
- `POST /api/submit`
- `GET /api/leaderboard`
- `GET /api/model/:id`
- `GET /api/submission/:id`
- `POST /api/flag`
- `GET /api/reports`
- `POST /api/reverification/process`

## Hub Web Pages

- `/` leaderboard page
- `/model/:id` model detail page
- `/submission/:id` submission detail page
- `/admin` admin page

## Minimal End-to-End Local Flow

1. Set `R2R_HUB_TOKEN` and `R2R_DATABASE_URL` for Hub.
2. Run migration: `pnpm --filter @req2rank/hub db:migrate`.
3. Start hub page/API server: `pnpm --filter @req2rank/hub next:dev`.
4. In CLI config, set:
   - `hub.enabled = true`
   - `hub.serverUrl = http://localhost:3000`
   - `hub.token = <same R2R_HUB_TOKEN>`
5. Execute:
   - `req2rank run --complexity C2 --rounds 1`
   - `req2rank submit --latest`
   - `req2rank leaderboard`

If reverification is enabled, trigger processor using `/api/reverification/process` and the configured secret header.
