# Implementation Plan

## Stage 1: Monorepo Bootstrap
**Goal**: Create pnpm workspace and package skeletons for `core` and `hub`.
**Success Criteria**: Root and package-level manifests exist; TypeScript base config is shared.
**Tests**: `pnpm -r typecheck` (after dependencies installed)
**Status**: Complete

## Stage 2: Provider Adapter Layer
**Goal**: Implement unified provider interface and adapters for OpenAI, Anthropic, Google, and Custom OpenAI-compatible endpoints.
**Success Criteria**: Adapters implement the same `LLMProvider` contract and return normalized response data.
**Tests**: Unit tests for request body shaping and response parsing.
**Status**: Complete

## Stage 3: Requirement Generator (C1-C2)
**Goal**: Implement seed + mutation based requirement generation with skill/domain/complexity metadata for C1-C2.
**Success Criteria**: Generator outputs structured requirement JSON with deterministic behavior under fixed seed.
**Tests**: Unit tests for deterministic generation and constraint injection.
**Status**: Complete

## Stage 4: Verification and Checkpoint Report
**Goal**: Run available checks and provide implementation checkpoint report.
**Success Criteria**: Verification commands are executed or blockers are documented with remediation steps.
**Tests**: `pnpm -r test`, `pnpm -r typecheck`.
**Status**: Complete

## Stage 5: CLI Pipeline MVP Backbone
**Goal**: Add pipeline orchestration and CLI entry commands (`init`, `run`, `history`, `report`) wired to core modules.
**Success Criteria**: CLI can initialize config, run a local dry pipeline, and print history/report from local data store.
**Tests**: CLI integration tests for command routing and basic run flow.
**Status**: Complete

## Stage 6: Execution/Evaluation/Scoring Engine Skeleton
**Goal**: Add execution engine, evaluation panel, and scoring engine interfaces with baseline implementation and tests.
**Success Criteria**: `run` command can pass through execute -> evaluate -> score stages and persist dimension scores.
**Tests**: Unit tests for scoring calculation and pipeline stage handoff.
**Status**: Complete

## Stage 7: Report Enrichment and History Detail
**Goal**: Extend `history` and `report` output to include per-dimension score details and run metadata.
**Success Criteria**: CLI outputs both overall and per-dimension scores for selected runs.
**Tests**: CLI integration assertions for dimension score rendering.
**Status**: Complete

## Stage 8: Config Override and CLI Flags
**Goal**: Add CLI override support (target model, complexity, rounds) with correct precedence over config defaults.
**Success Criteria**: `run` command accepts overrides and stores run metadata that reflects effective runtime options.
**Tests**: CLI integration tests for override parsing and precedence behavior.
**Status**: Complete

## Stage 9: Markdown Report Output
**Goal**: Add local markdown report generation for `report` command including overall score, dimension scores, and metadata.
**Success Criteria**: `report <run-id>` can output markdown content and optionally write to a file path.
**Tests**: CLI integration test asserting markdown headers and key fields.
**Status**: Complete

## Stage 10: SQLite Local Persistence
**Goal**: Replace JSON local store with SQLite-backed run persistence while preserving CLI behavior.
**Success Criteria**: `run`, `history`, and `report` read/write from SQLite and existing tests remain green.
**Tests**: Store unit tests plus existing CLI integration suite.
**Status**: Complete

## Stage 11: Submit/Leaderboard CLI Skeleton
**Goal**: Add `submit` and `leaderboard` CLI command skeletons with typed request/response contracts.
**Success Criteria**: Commands run with config validation and clear placeholder output for future hub integration.
**Tests**: CLI integration tests for command registration and argument handling.
**Status**: Complete

## Stage 12: Config Precedence with Environment Variables
**Goal**: Implement config precedence `CLI > ENV > config file > defaults` for key runtime fields.
**Success Criteria**: Runtime config resolves env overrides for target/system/judges/test fields when CLI flags are absent.
**Tests**: Unit/integration tests validating precedence across CLI options, env vars, and config file values.
**Status**: Complete

## Stage 13: Hub Client Placeholder Module
**Goal**: Add a reusable core hub client placeholder for nonce/request APIs used by CLI submit/leaderboard commands.
**Success Criteria**: CLI command handlers call typed hub client interfaces instead of inline placeholder strings.
**Tests**: Unit tests for hub client method contracts and CLI integration with mocked client.
**Status**: Complete

## Stage 14: Nonce Handshake Contract (CLI/Core)
**Goal**: Extend hub client and submit flow with nonce request contract and payload field wiring.
**Success Criteria**: `submit` obtains/uses nonce through hub client contract before submit call.
**Tests**: Hub client unit test and CLI integration test asserting nonce call order.
**Status**: Complete

## Stage 15: Hub Package API Route Skeleton
**Goal**: Add minimal Next.js-style API route skeletons in hub package for `/api/nonce`, `/api/submit`, and `/api/leaderboard`.
**Success Criteria**: Route handlers expose typed request/response contracts matching core hub client.
**Tests**: Hub unit tests for route validation and response shapes.
**Status**: Complete

## Stage 16: Evidence Chain Data Contract
**Goal**: Introduce typed evidence-chain payload structures in core and include placeholders in submit flow.
**Success Criteria**: Submit request payload includes timeline/samples/environment contract fields for future hub verification.
**Tests**: Core unit tests for payload shape generation and CLI submit integration assertions.
**Status**: Complete

## Stage 17: Scoring Agreement and Confidence Interval (MVP)
**Goal**: Extend scoring output with basic agreement and confidence interval metrics.
**Success Criteria**: Run records include CI bounds and agreement level placeholder derived from judge scores.
**Tests**: Scoring unit tests for CI calculation and agreement classification.
**Status**: Complete

## Stage 18: Report Surface for CI/Agreement
**Goal**: Expose CI and agreement metadata in text/markdown report outputs.
**Success Criteria**: `report` displays CI and agreement level alongside overall score.
**Tests**: CLI integration assertions for CI and agreement fields in report outputs.
**Status**: Complete

## Stage 19: Hub Nonce/Submit Endpoint Composition
**Goal**: Provide composable handler wrappers representing `/api/nonce` and `/api/submit` with shared validation hooks.
**Success Criteria**: Hub routes can be reused from an app-router endpoint shim without duplicating validation logic.
**Tests**: Hub tests for wrapper behavior and invalid payload handling.
**Status**: Complete

## Stage 20: CLI Report Export Command
**Goal**: Add dedicated `export` command to write latest or selected run report in markdown/json formats.
**Success Criteria**: `export --latest --format markdown` and `export <run-id> --format json` both generate files.
**Tests**: CLI integration tests for export command argument validation and file output.
**Status**: Complete

## Stage 21: Submit Payload Builder Extraction
**Goal**: Extract submit payload assembly into a reusable core builder utility for easier testing and hub evolution.
**Success Criteria**: CLI submit uses builder function and tests validate generated payload fields independently.
**Tests**: Core unit tests for builder output; CLI integration remains green.
**Status**: Complete

## Stage 22: Export Command Validation Matrix
**Goal**: Strengthen export command validation for unsupported format, missing output path, and missing run selection.
**Success Criteria**: Export fails with clear messages for invalid argument combinations.
**Tests**: CLI integration tests for error scenarios and message assertions.
**Status**: Complete

## Stage 23: Hub Route Error Envelope
**Goal**: Normalize hub route errors into a consistent typed envelope for downstream API layer mapping.
**Success Criteria**: Route handlers return structured error payloads with code/message rather than uncaught throws.
**Tests**: Hub tests for invalid requests asserting envelope shape and status mapping hints.
**Status**: Complete

## Stage 24: Leaderboard Sort/Pagination Contract
**Goal**: Add explicit sort direction and offset/limit pagination contract to leaderboard route and client placeholders.
**Success Criteria**: Leaderboard APIs accept sort/pagination options with deterministic ordering in responses.
**Tests**: Hub and core tests for pagination bounds and sort behavior.
**Status**: Complete

## Stage 25: CLI Leaderboard Validation Matrix
**Goal**: Add dedicated CLI tests for leaderboard argument validation (`--sort`, `--offset`, `--limit`) and query forwarding behavior.
**Success Criteria**: Invalid leaderboard args fail with clear errors; valid args are forwarded to hub client query contract.
**Tests**: CLI integration tests for invalid argument cases and forwarding assertions.
**Status**: Complete

## Stage 26: Core Leaderboard Query Schema
**Goal**: Add shared zod schema for leaderboard query validation in core and reuse it across cli/hub entry points.
**Success Criteria**: Parsing behavior for sort/offset/limit is centralized and consistent.
**Tests**: Core unit tests for schema validation boundaries and normalization behavior.
**Status**: Complete

## Stage 27: Leaderboard Output Modes
**Goal**: Add leaderboard output mode options (`table`/`json`) in CLI while preserving current default text mode.
**Success Criteria**: Users can request structured JSON output for automation workflows.
**Tests**: CLI integration tests for output mode formatting and validation.
**Status**: Complete

## Stage 28: Hub Envelope for Leaderboard Handler
**Goal**: Add composed leaderboard handler wrapper that returns standardized route envelopes similar to nonce/submit.
**Success Criteria**: Leaderboard wrapper returns success/error envelopes with shared auth validation hook behavior.
**Tests**: Hub tests covering success envelope, auth failure envelope, and invalid query envelope.
**Status**: Complete

## Stage 29: CLI Export Filename Defaults
**Goal**: Add default output filename behavior for `export` when `--out` is omitted, based on run id and format.
**Success Criteria**: Export writes to predictable default paths and still supports explicit `--out` override.
**Tests**: CLI integration tests for default path generation across markdown/json outputs.
**Status**: Complete

## Stage 30: History Output Modes
**Goal**: Add `history --output json` mode while preserving default human-readable text output.
**Success Criteria**: History command supports machine-readable JSON for automation and scripting.
**Tests**: CLI integration tests for history output mode selection and validation.
**Status**: Complete

## Stage 31: Report Output Mode Unification
**Goal**: Unify report/history/leaderboard output mode handling behind shared helpers to reduce duplicated validation logic.
**Success Criteria**: Output mode parsing is centralized and behavior remains backward-compatible.
**Tests**: CLI integration regression suite plus unit tests for shared output-mode helpers.
**Status**: Complete

## Stage 32: Shared CLI Formatter Module
**Goal**: Extract reusable formatter functions for `text`/`table`/`json` rendering used by report/history/leaderboard/export.
**Success Criteria**: Command handlers delegate rendering to shared formatter module; no duplicated string assembly blocks remain in handlers.
**Tests**: Unit tests for formatter outputs and snapshot-style assertions for key rendering cases.
**Status**: Complete

## Stage 33: Configurable Report Templates (MVP)
**Goal**: Add template selection for report/export outputs (default/compact) while preserving current default layout.
**Success Criteria**: Users can choose template via CLI flag and receive deterministic output shape for each template.
**Tests**: CLI integration tests for template switching and regression assertions for default template compatibility.
**Status**: Complete

## Stage 34: CLI Command Error Taxonomy
**Goal**: Introduce standardized CLI error codes/messages (validation/not-found/runtime) and consistent user-facing formatting.
**Success Criteria**: All command failures map to normalized error structure with predictable wording.
**Tests**: Integration tests validating representative failures per command and their normalized error outputs.
**Status**: Complete

## Stage 35: End-to-End Smoke Scenario Pack
**Goal**: Add scripted smoke scenarios covering init -> run -> history -> report -> export -> submit -> leaderboard flows.
**Success Criteria**: One command can execute end-to-end smoke checks in CI-friendly mode and verify critical outputs/files.
**Tests**: Dedicated smoke test script and CI-style command assertions for success path plus one guarded failure path.
**Status**: Complete

## Stage 36: Plan/Repo Alignment Finalization
**Goal**: Align `plan.md`, CLI behavior, docs structure, repository baseline assets, and CI quality gates.
**Success Criteria**: Plan markdown renders cleanly, `submit --latest` behavior matches docs, root baseline files exist, docs navigation matches actual docs files, and CI runs baseline/doc consistency checks.
**Tests**: `pnpm --filter @req2rank/cli test -- src/smoke.test.ts`, `pnpm check:baseline`, `pnpm check:cli-doc-sync`.
**Status**: Complete

Checklist:
- [x] Fix `plan.md` markdown code fence break in scoring section.
- [x] Implement `req2rank submit --latest` and add CLI smoke assertions.
- [x] Add root assets (`README.md`, `LICENSE`, `examples/*`, `.github/ISSUE_TEMPLATE/*`).
- [x] Align docs structure references (`plan.md`, README, VitePress navigation) to `docs/site/*`.
- [x] Document Hub public APIs and page entry points in docs.
- [x] Add CI quality gates for baseline files and CLI docs consistency.
