# Changelog

All notable changes to this project are documented in this file.

## v0.1.0 - 2026-02-20

### Added

- Monorepo workspace with `@req2rank/core`, `@req2rank/cli`, and `@req2rank/hub`.
- End-to-end benchmark pipeline: requirement generation, execution, multi-judge evaluation, and scoring.
- CLI commands: `init`, `run`, `compare`, `history`, `report`, `export`, `submit`, `leaderboard`, `calibrate`, `sandbox`.
- Evidence-chain based Hub submission protocol with nonce and verification workflow.
- Hub leaderboard pages and APIs, including public and authenticated routes.
- VitePress documentation site and deployment/release runbooks.

### Changed

- Added explicit package publish/readiness documentation and release checklist.
- Improved local build flow to include Hub Next.js production build from root script.

### Fixed

- CLI publish artifact now excludes test files from `dist` build output.
- Added package publish whitelist for CLI to avoid shipping unnecessary files.
- Hub app state store now lazily initializes with in-memory fallback when DB client init fails.
