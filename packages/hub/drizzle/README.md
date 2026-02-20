# Hub migration baseline

This folder contains the historical migration chain used in deployed environments.

Notes:
- There are two legacy migrations with `0001_*` prefixes. They are preserved intentionally to keep previously deployed databases compatible.
- New migrations must continue with monotonically increasing identifiers (`0002`, `0003`, ... by creation order in `meta/_journal.json`).
- Do not rename or reorder existing migration files after they have been applied in production.

Operational guidance:
1. Apply migrations with `pnpm --filter @req2rank/hub db:migrate`.
2. Keep migration SQL idempotent for additive column changes (`ADD COLUMN IF NOT EXISTS`).
3. For future baseline squashing, create a dedicated one-time migration and coordinate a controlled downtime window.
