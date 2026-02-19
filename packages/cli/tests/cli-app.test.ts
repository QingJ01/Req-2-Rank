import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCliApp } from "../src/app.js";
import { Req2RankConfig, createPipelineCheckpointKey } from "@req2rank/core";

const createdDirs: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    createdDirs.splice(0, createdDirs.length).map(async (dir) => {
      const { rm } = await import("node:fs/promises");
      await rm(dir, { recursive: true, force: true });
    })
  );
});

describe("CLI app", () => {
  it("writes default config during init", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-init-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);

    const content = await readFile(join(cwd, "req2rank.config.json"), "utf-8");
    const parsed = JSON.parse(content) as { target: { provider: string } };
    expect(parsed.target.provider).toBe("openai");
  });

  it("runs pipeline and can query history/report", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-run-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);

    const runResult = await app.run(["run"]);
    expect(runResult).toContain("Run completed:");

    const historyResult = await app.run(["history"]);
    expect(historyResult).toContain("Run count: 1");
    expect(historyResult).toContain("run-");

    const historyJson = await app.run(["history", "--output", "json"]);
    const parsedHistory = JSON.parse(historyJson) as Array<{ id: string; overallScore: number }>;
    expect(parsedHistory).toHaveLength(1);
    expect(parsedHistory[0].id).toContain("run-");

    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const reportResult = await app.run(["report", runId ?? ""]);
    expect(reportResult).toContain("Overall score:");
    expect(reportResult).toContain("logicAccuracy");
    expect(reportResult).toContain("CI95:");
    expect(reportResult).toContain("Agreement:");
  });

  it("fails history when output mode is invalid", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-history-invalid-output-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await expect(app.run(["history", "--output", "yaml"])).rejects.toThrow("Invalid --output value: yaml");
  });

  it("normalizes validation and not-found errors with codes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-error-codes-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await expect(app.run(["history", "--output", "yaml"])).rejects.toThrow("[VALIDATION]");
    await expect(app.run(["report", "run-missing"])).rejects.toThrow("[NOT_FOUND]");
  });

  it("normalizes runtime errors with codes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-runtime-error-code-"));
    createdDirs.push(cwd);

    const app = createCliApp({
      cwd,
      hubClient: {
        async requestNonce() {
          throw new Error("network timeout");
        },
        async submit() {
          return { status: "pending", message: "pending" };
        },
        async getLeaderboard() {
          return [];
        }
      }
    });

    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    await expect(app.run(["submit", runId ?? ""])).rejects.toThrow("[RUNTIME]");
  });

  it("applies run overrides with CLI precedence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-override-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);

    const runResult = await app.run(["run", "--target", "anthropic/claude-sonnet-4-20250514", "--complexity", "C2", "--rounds", "3"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const reportResult = await app.run(["report", runId ?? ""]);
    expect(reportResult).toContain("Target: anthropic/claude-sonnet-4-20250514");
    expect(reportResult).toContain("Complexity: C2");
    expect(reportResult).toContain("Rounds: 3");
  });

  it("renders markdown report and writes to file", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-markdown-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const outputPath = join(cwd, "report.md");
    const markdown = await app.run(["report", runId ?? "", "--markdown", "--out", outputPath]);

    expect(markdown).toContain("# Req2Rank Report");
    expect(markdown).toContain("## Metadata");
    expect(markdown).toContain("## Dimension Scores");
    expect(markdown).toContain("- CI95:");
    expect(markdown).toContain("- Agreement:");

    const fileContent = await readFile(outputPath, "utf-8");
    expect(fileContent).toContain("# Req2Rank Report");
  });

  it("renders compact report template", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-report-compact-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const reportResult = await app.run(["report", runId ?? "", "--template", "compact"]);
    expect(reportResult).toContain("Compact Report");
    expect(reportResult).toContain("Overall score:");
    expect(reportResult).not.toContain("Dimension Scores");
  });

  it("exports compact markdown template", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-export-compact-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const outPath = join(cwd, "compact.md");
    await app.run(["export", runId ?? "", "--format", "markdown", "--template", "compact", "--out", outPath]);
    const content = await readFile(outPath, "utf-8");
    expect(content).toContain("Compact Report");
  });

  it("fails report when template is invalid", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-report-template-invalid-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    await expect(app.run(["report", runId ?? "", "--template", "fancy"])).rejects.toThrow(
      "Invalid --template value: fancy"
    );
  });

  it("supports submit skeleton command", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-submit-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const submitResult = await app.run(["submit", runId ?? ""]);
    expect(submitResult).toContain("Submit pending");
    expect(submitResult).toContain(runId ?? "");
  });

  it("uses hub config to create real hub client when enabled", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-hub-config-"));
    createdDirs.push(cwd);

    const fetchMock = vi.fn(async (input: string) => {
      if (input.endsWith("/api/nonce")) {
        return new Response(JSON.stringify({ nonce: "nonce-http", expiresAt: "2026-01-01T00:00:00.000Z" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (input.endsWith("/api/submit")) {
        return new Response(JSON.stringify({ status: "accepted", message: "submitted-from-http" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = createCliApp({ cwd });
    await app.run(["init"]);

    const configPath = join(cwd, "req2rank.config.json");
    const config = JSON.parse(await readFile(configPath, "utf-8")) as {
      hub?: { enabled?: boolean; serverUrl?: string; token?: string };
    };
    config.hub = {
      enabled: true,
      serverUrl: "https://hub.example.com",
      token: "token-1"
    };
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    const submitResult = await app.run(["submit", runId ?? ""]);

    expect(submitResult).toContain("submitted-from-http");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("supports leaderboard skeleton command", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-leaderboard-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    const leaderboardResult = await app.run(["leaderboard"]);
    expect(leaderboardResult).toContain("1. placeholder/model-1");
  });

  it("applies environment overrides when CLI flags are absent", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-env-"));
    createdDirs.push(cwd);

    const app = createCliApp({
      cwd,
      env: {
        R2R_TARGET_PROVIDER: "google",
        R2R_TARGET_MODEL: "gemini-1.5-pro",
        R2R_TEST_COMPLEXITY: "C2",
        R2R_TEST_ROUNDS: "4"
      }
    });
    await app.run(["init"]);

    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    const reportResult = await app.run(["report", runId ?? ""]);

    expect(reportResult).toContain("Target: google/gemini-1.5-pro");
    expect(reportResult).toContain("Complexity: C2");
    expect(reportResult).toContain("Rounds: 4");
  });

  it("prefers CLI flags over environment overrides", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-env-cli-"));
    createdDirs.push(cwd);

    const app = createCliApp({
      cwd,
      env: {
        R2R_TARGET_PROVIDER: "google",
        R2R_TARGET_MODEL: "gemini-1.5-pro",
        R2R_TEST_COMPLEXITY: "C2",
        R2R_TEST_ROUNDS: "4"
      }
    });
    await app.run(["init"]);

    const runResult = await app.run(["run", "--target", "openai/gpt-4o-mini", "--complexity", "C1", "--rounds", "1"]);
    const runId = runResult.split(":").at(1)?.trim();
    const reportResult = await app.run(["report", runId ?? ""]);

    expect(reportResult).toContain("Target: openai/gpt-4o-mini");
    expect(reportResult).toContain("Complexity: C1");
    expect(reportResult).toContain("Rounds: 1");
  });

  it("uses injected hub client for submit and leaderboard", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-hub-client-"));
    createdDirs.push(cwd);

    const events: string[] = [];
    const app = createCliApp({
      cwd,
      hubClient: {
        async requestNonce() {
          events.push("nonce");
          return {
            nonce: "nonce-123",
            expiresAt: new Date("2026-01-01T00:00:00.000Z").toISOString()
          };
        },
        async submit(payload) {
          events.push(`submit:${payload.runId}:${payload.nonce}`);
          events.push(`timeline:${payload.evidenceChain.timeline.length}`);
          events.push(`env:${payload.evidenceChain.environment.os}`);
          return { status: "accepted", message: "submitted" };
        },
        async getLeaderboard(query) {
          events.push(`leaderboard:${query.limit}:${query.offset}:${query.sort}`);
          return [
            { rank: 1, model: "openai/gpt-4o-mini", score: 91.2 },
            { rank: 2, model: "anthropic/claude-sonnet-4-20250514", score: 89.4 }
          ];
        }
      }
    });

    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const submitResult = await app.run(["submit", runId ?? ""]);
    expect(submitResult).toContain("submitted");

    const leaderboardResult = await app.run(["leaderboard", "--limit", "2"]);
    expect(leaderboardResult).toContain("1. openai/gpt-4o-mini");
    expect(events).toEqual([
      "nonce",
      `submit:${runId}:nonce-123`,
      "timeline:4",
      `env:${process.platform}`,
      "leaderboard:2:0:desc"
    ]);
  });

  it("passes leaderboard pagination and sort options to hub client", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-leaderboard-query-"));
    createdDirs.push(cwd);

    const calls: string[] = [];
    const app = createCliApp({
      cwd,
      hubClient: {
        async requestNonce() {
          return { nonce: "nonce", expiresAt: new Date("2026-01-01T00:00:00.000Z").toISOString() };
        },
        async submit() {
          return { status: "pending", message: "pending" };
        },
        async getLeaderboard(query) {
          calls.push(`${query.limit}:${query.offset}:${query.sort}`);
          return [{ rank: 1, model: "m", score: 1 }];
        }
      }
    });

    await app.run(["leaderboard", "--limit", "2", "--offset", "1", "--sort", "asc"]);
    expect(calls).toEqual(["2:1:asc"]);
  });

  it("renders leaderboard as json when requested", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-leaderboard-json-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    const result = await app.run(["leaderboard", "--output", "json", "--limit", "2"]);

    const parsed = JSON.parse(result) as Array<{ rank: number; model: string; score: number }>;
    expect(parsed).toHaveLength(2);
    expect(parsed[0].rank).toBe(1);
  });

  it("renders leaderboard as table when requested", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-leaderboard-table-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    const result = await app.run(["leaderboard", "--output", "table", "--limit", "2"]);

    expect(result).toContain("Rank | Model");
    expect(result).toContain("1 |");
  });

  it("fails leaderboard when output mode is invalid", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-leaderboard-output-invalid-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await expect(app.run(["leaderboard", "--output", "yaml"])).rejects.toThrow("Invalid --output value: yaml");
  });

  it("fails leaderboard when limit is not a strict integer", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-leaderboard-bad-limit-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await expect(app.run(["leaderboard", "--limit", "2x"])).rejects.toThrow("Invalid --limit value: 2x");
  });

  it("fails leaderboard when offset is not a strict integer", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-leaderboard-bad-offset-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await expect(app.run(["leaderboard", "--offset", "1abc"])).rejects.toThrow("Invalid --offset value: 1abc");
  });

  it("exports latest run report as markdown", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-export-latest-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    await app.run(["run"]);

    const outPath = join(cwd, "latest.md");
    const result = await app.run(["export", "--latest", "--format", "markdown", "--out", outPath]);
    expect(result).toContain("Exported report:");

    const content = await readFile(outPath, "utf-8");
    expect(content).toContain("# Req2Rank Report");
  });

  it("exports selected run report as json", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-export-json-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const outPath = join(cwd, "report.json");
    await app.run(["export", runId ?? "", "--format", "json", "--out", outPath]);

    const content = await readFile(outPath, "utf-8");
    const parsed = JSON.parse(content) as { runId: string; overallScore: number };
    expect(parsed.runId).toBe(runId);
    expect(typeof parsed.overallScore).toBe("number");
  });

  it("fails export on unsupported format", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-export-invalid-format-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    await app.run(["run"]);

    await expect(app.run(["export", "--latest", "--format", "xml", "--out", join(cwd, "x.xml")])).rejects.toThrow(
      "Invalid --format value: xml"
    );
  });

  it("uses default markdown path when --out is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-export-no-out-md-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const output = await app.run(["export", runId ?? "", "--format", "markdown"]);
    expect(output).toContain(`${runId}.md`);

    const defaultPath = join(cwd, ".req2rank", "exports", `${runId}.md`);
    const content = await readFile(defaultPath, "utf-8");
    expect(content).toContain("# Req2Rank Report");
  });

  it("uses default json path when --out is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-export-no-out-json-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const output = await app.run(["export", runId ?? "", "--format", "json"]);
    expect(output).toContain(`${runId}.json`);

    const defaultPath = join(cwd, ".req2rank", "exports", `${runId}.json`);
    const content = await readFile(defaultPath, "utf-8");
    const parsed = JSON.parse(content) as { runId: string };
    expect(parsed.runId).toBe(runId);
  });

  it("fails export when run selector is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-export-no-selector-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    await app.run(["run"]);

    await expect(app.run(["export", "--format", "markdown", "--out", join(cwd, "a.md")])).rejects.toThrow(
      "runId is required unless --latest is used"
    );
  });

  it("fails export when runId and --latest are both provided", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-export-conflict-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    await expect(
      app.run(["export", runId ?? "", "--latest", "--format", "markdown", "--out", join(cwd, "b.md")])
    ).rejects.toThrow("runId cannot be used together with --latest");
  });

  it("runs multi-model compare and outputs per-target scores", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-compare-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);

    const result = await app.run([
      "compare",
      "--targets",
      "openai/gpt-4o-mini,anthropic/claude-sonnet-4-20250514",
      "--complexity",
      "C3"
    ]);

    expect(result).toContain("openai/gpt-4o-mini =>");
    expect(result).toContain("anthropic/claude-sonnet-4-20250514 =>");
  });

  it("calibrates complexity and can persist recommendation", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-calibrate-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);
    await app.run(["run", "--complexity", "C2"]);

    const output = await app.run(["calibrate", "--write"]);
    expect(output).toContain("C");

    const config = JSON.parse(await readFile(join(cwd, "req2rank.config.json"), "utf-8")) as {
      test: { complexity: string };
    };
    expect(config.test.complexity).toMatch(/^C[1-4]$/);
  });

  it("resumes run from checkpoint snapshot when available", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-checkpoint-resume-"));
    createdDirs.push(cwd);

    const app = createCliApp({ cwd });
    await app.run(["init"]);

    const checkpointPath = join(cwd, ".req2rank", "checkpoints.json");
    const config = JSON.parse(await readFile(join(cwd, "req2rank.config.json"), "utf-8")) as Req2RankConfig;
    const checkpointKey = createPipelineCheckpointKey("run", config);
    await mkdir(join(cwd, ".req2rank"), { recursive: true });
    await writeFile(
      checkpointPath,
      JSON.stringify(
        {
          [checkpointKey]: {
            version: 1,
            createdAt: "2026-01-01T00:00:00.000Z",
            totalRounds: 1,
            completedRounds: [
              {
                index: 0,
                overallScore: 99,
                dimensionScores: {
                  functionalCompleteness: 99,
                  codeQuality: 99,
                  logicAccuracy: 99,
                  security: 99,
                  engineeringPractice: 99
                },
                ija: 1,
                requirementTitle: "Checkpointed Requirement"
              }
            ]
          }
        },
        null,
        2
      ),
      "utf-8"
    );

    const runResult = await app.run(["run"]);
    const runId = runResult.split(":").at(1)?.trim();
    expect(runId).toBeTruthy();

    const report = await app.run(["report", runId ?? ""]);
    expect(report).toContain("Overall score: 99");

    const checkpoints = JSON.parse(await readFile(checkpointPath, "utf-8")) as Record<string, unknown>;
    expect(checkpoints[checkpointKey]).toBeUndefined();
  });
});
