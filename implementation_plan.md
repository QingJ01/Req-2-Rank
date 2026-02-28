## Stage 1: Enforce Complexity-Scoped Leaderboards
**Goal**: Ensure all leaderboard surfaces are complexity-specific and never show mixed scores by default.
**Success Criteria**:
- App page defaults to `C3`, supports `C1/C2/C3/C4` switching, and keeps strategy + complexity in links.
- Header top models, public leaderboard API, and live SSE leaderboard all default to `C3`.
- Model trend data in leaderboard page is filtered by selected complexity.
**Tests**:
- `pnpm --filter @req2rank/hub test -- src/app/next-pages.test.tsx src/routes.test.ts`
- `pnpm --filter @req2rank/hub next:build`
**Status**: In Progress

## Stage 2: Harden Public Data Exposure
**Goal**: Prevent accidental data leakage and unsafe default exposure in public endpoints.
**Success Criteria**:
- Public model endpoint returns a redacted view by default (no raw code/evidence chain unless explicitly allowed).
- Public API auth mode is explicit: either API key required or a dedicated env switch to allow anonymous access.
- Public live stream model payload aligns with the same redaction policy.
**Tests**:
- Add route tests for `/api/public/model/[id]` and `/api/public/live/stream` covering unauthorized/authorized/redacted responses.
- `pnpm --filter @req2rank/hub test -- src/app/api/public/model/[id]/route.test.ts src/app/api/public/live/stream/route.test.ts`
**Status**: Not Started

## Stage 3: Fix Review Queue Consistency
**Goal**: Make reverification queue and moderation state deterministic, idempotent, and non-destructive.
**Success Criteria**:
- Queue insertion is idempotent per `runId + reason` (unique constraint or upsert behavior).
- Submission upsert no longer resets moderation flags unexpectedly.
- New score-drift auto-review rule is added (`abs(newScore - modelMeanExcludingDisputed) > 5`) with minimum sample gate.
- Score-drift jobs have explicit reason (e.g. `score-drift`) and are visible in admin logs.
**Tests**:
- Extend `src/routes.test.ts` for queue dedup + score-drift trigger edge cases (`=5`, `>5`, cold start).
- Extend `src/reverification-worker.test.ts` for new reason handling.
- `pnpm --filter @req2rank/hub test -- src/routes.test.ts src/reverification-worker.test.ts`
**Status**: Not Started

## Stage 4: Improve Query Performance and Operability
**Goal**: Remove full-table in-memory aggregation bottlenecks and reduce live stream DB pressure.
**Success Criteria**:
- Leaderboard query uses SQL-side grouping/aggregation with pagination after aggregation.
- Required DB indexes exist (`model`, `complexity`, `submitted_at`, `verification_status`).
- Live stream uses short-lived cache/throttle per complexity to avoid re-query storms across connections.
- No behavior regressions for `mean`, `best`, `latest`, and dimension sort paths.
**Tests**:
- Add/extend DB-backed tests for strategy parity against previous behavior.
- `pnpm --filter @req2rank/hub test -- src/lib/db/client.test.ts src/routes.test.ts`
- `pnpm --filter @req2rank/hub next:build`
**Status**: Not Started

## Stage 5: End-to-End Verification and Release Guardrails
**Goal**: Ship with reproducible validation, deployment confidence, and operational runbook updates.
**Success Criteria**:
- Full Hub tests pass in CI-stable mode (single worker fallback documented for low-memory runners).
- Vercel build succeeds on latest commit with production env assumptions documented.
- Deployment doc includes complexity policy, public API exposure policy, and reverification queue semantics.
**Tests**:
- `pnpm --filter @req2rank/hub build`
- `pnpm --filter @req2rank/hub test -- src/middleware.test.ts src/routes.test.ts src/reverification-worker.test.ts src/app/next-pages.test.tsx`
- `pnpm --filter @req2rank/hub next:build`
**Status**: Not Started
