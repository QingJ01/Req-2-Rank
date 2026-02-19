# Getting Started

## Prerequisites

- Node.js 18+
- pnpm 9+

## Install

```bash
pnpm install
```

## Build and Verify

```bash
pnpm typecheck
pnpm test
pnpm --filter @req2rank/cli build
```

## First Local Run

```bash
req2rank init
req2rank run --complexity C2 --rounds 1
req2rank history
```

## Inspect and Export

```bash
req2rank report <run-id>
req2rank export --latest --format markdown
```

## Submit to Hub

```bash
req2rank submit --latest
req2rank leaderboard --output table
```

Before submitting, make sure hub settings are enabled in your config.
