# Req-2-Rank

Req-2-Rank is an open benchmarking framework for evaluating coding models with dynamic requirements, multi-judge scoring, confidence intervals, and a community leaderboard flow.

## Repository Layout

- `packages/core`: benchmarking pipeline engine, scoring, persistence, provider adapters.
- `packages/cli`: `req2rank` CLI command implementation.
- `packages/hub`: Next.js leaderboard hub (API + web pages).
- `packages/web-ui`: local visualization UI for benchmark runs.
- `docs/site`: VitePress docs site.
- `examples`: sample configuration files.

## Quick Start

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @req2rank/cli build
```

Create config and run one local benchmark:

```bash
req2rank init
req2rank run --complexity C2 --rounds 1
req2rank history
```

## CLI Commands

<!-- cli-commands:start -->
- `req2rank init`
- `req2rank run [--target <provider/model>] [--complexity <C1|C2|C3|C4|mixed>] [--rounds <count>]`
- `req2rank compare --targets <provider/model,...> [--complexity <level>] [--rounds <count>]`
- `req2rank history [--output <text|json>]`
- `req2rank report <runId> [--markdown] [--template <default|compact>] [--out <filePath>]`
- `req2rank export [runId] [--latest] [--format <markdown|json>] [--template <default|compact>] [--out <filePath>]`
- `req2rank submit [runId] [--latest]`
- `req2rank leaderboard [--limit <count>] [--offset <count>] [--sort <asc|desc>] [--output <text|table|json>]`
- `req2rank calibrate [--write]`
- `req2rank sandbox [--image <image>] [--command <command>]`
<!-- cli-commands:end -->

## Docs

- Docs home: `docs/site/index.md`
- Getting started: `docs/site/getting-started.md`
- Configuration: `docs/site/configuration.md`
- Scoring methodology: `docs/site/scoring-methodology.md`
- Hub APIs and pages: `docs/site/hub.md`
- Contributing: `docs/site/contributing.md`

## Development Checks

```bash
pnpm check:baseline
pnpm check:cli-doc-sync
```

## License

MIT. See `LICENSE`.
