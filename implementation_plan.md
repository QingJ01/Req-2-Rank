## Stage 1: Stabilize Auth Gate Behavior
**Goal**: Ensure `/admin` gate has deterministic redirect behavior with no loops and clear fallback paths.
**Success Criteria**:
- `proxy` is the only Next.js request gate entry (no `middleware.ts` conflict).
- Missing session cookie redirects to GitHub login with `redirect=/admin`.
- Stale/invalid session redirects through logout to clear cookie.
- Session store errors redirect to `/auth` (without forced logout).
**Tests**:
- `pnpm --filter @req2rank/hub test -- src/middleware.test.ts`
- Manually verify: `/admin` with no cookie, stale cookie, valid admin cookie.
**Status**: In Progress

## Stage 2: Lock Security Boundaries
**Goal**: Keep auth redirects safe while preserving expected admin and user flow.
**Success Criteria**:
- Logout blocks external-origin redirects (open redirect prevention).
- OAuth callback only allows same-origin redirects.
- Non-admin callback requesting `/admin` falls back safely.
**Tests**:
- `pnpm --filter @req2rank/hub test -- src/app/api/auth/[...github]/route.test.ts`
**Status**: Not Started

## Stage 3: Build & Deploy Reliability
**Goal**: Make Vercel builds reproducible and prevent CI-only failures.
**Success Criteria**:
- `@req2rank/hub` TypeScript build passes in clean environment.
- Next.js build passes with current proxy architecture.
- No test-only TypeScript errors block production build.
**Tests**:
- `pnpm --filter @req2rank/hub build`
- `pnpm --filter @req2rank/hub next:build`
**Status**: Not Started

## Stage 4: Expand Regression Coverage
**Goal**: Cover critical auth/admin edge cases to avoid recurrence.
**Success Criteria**:
- Tests include stale cookie, store failure, non-admin access, and callback redirect safety.
- Each redirect branch in `proxy` has at least one test assertion.
- Test names map directly to user-facing behavior.
**Tests**:
- `pnpm --filter @req2rank/hub test -- src/middleware.test.ts src/app/api/auth/[...github]/route.test.ts src/app/api/admin/reports/route.test.ts`
**Status**: Not Started

## Stage 5: Final Verification and Cleanup
**Goal**: Ship with a clean branch and auditable validation evidence.
**Success Criteria**:
- Working tree clean after final fixes.
- Vercel deployment succeeds on latest commit.
- Post-deploy smoke checks pass for `/admin`, `/auth`, and key APIs.
**Tests**:
- `git status -sb`
- `pnpm --filter @req2rank/hub test`
- Post-deploy: `/admin`, `/auth`, `/api/auth/github?action=login`, `/api/public/leaderboard`
**Status**: Not Started
