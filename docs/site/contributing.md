# Contributing

## Setup

```bash
pnpm install
pnpm typecheck
pnpm test
```

## Repository Baseline Checks

```bash
pnpm check:baseline
pnpm check:cli-doc-sync
```

## Package-Level Commands

- Core: `pnpm --filter @req2rank/core test`
- CLI: `pnpm --filter @req2rank/cli test`
- Hub: `pnpm --filter @req2rank/hub test`
- Docs: `pnpm --dir docs/site build`

## Pull Request Notes

- Keep `plan.md` and implementation behavior aligned.
- Add or update tests for behavior changes.
- Update docs in `docs/site/*` when command behavior or API routes change.
