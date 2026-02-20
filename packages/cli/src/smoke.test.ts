import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliApp } from "./app.js";

describe("cli smoke scenarios", () => {
  async function withCli(runTest: (cwd: string) => Promise<void>) {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-cli-smoke-"));
    try {
      await runTest(cwd);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }

  it("covers init -> run -> history -> report -> export -> submit -> leaderboard", async () => {
    await withCli(async (cwd) => {
      const app = createCliApp({
        cwd,
        hubClient: {
          requestNonce: async () => ({ nonce: "nonce-123", expiresAt: new Date().toISOString() }),
          submit: async (payload) => ({
            status: "accepted",
            message: `Submitted ${payload.runId}`
          }),
          getLeaderboard: async () => [{ rank: 1, model: "openai/gpt-4o-mini", score: 91.2 }],
          submitCalibration: async () => ({ ok: true })
        }
      });

      const initOutput = await app.run(["init"]);
      expect(initOutput).toContain("Config initialized:");

      const runOutput = await app.run(["run", "--complexity", "C2", "--rounds", "1"]);
      expect(runOutput).toContain("Run completed:");
      const runId = runOutput.replace("Run completed: ", "").trim();
      expect(runId.startsWith("run-")).toBe(true);

      const historyOutput = await app.run(["history"]);
      expect(historyOutput).toContain("Run count: 1");
      expect(historyOutput).toContain(runId);

      const reportOutput = await app.run(["report", runId]);
      expect(reportOutput).toContain("Target: openai/gpt-4o-mini");
      expect(reportOutput).toContain("Overall score:");

      const exportPath = join(cwd, ".req2rank", "smoke", `${runId}.md`);
      const exportOutput = await app.run(["export", runId, "--format", "markdown", "--out", exportPath]);
      expect(exportOutput).toContain("Exported report:");
      await access(exportPath);
      const exportContent = await readFile(exportPath, "utf-8");
      expect(exportContent).toContain("# Req2Rank Report");

      const submitOutput = await app.run(["submit", "--latest"]);
      expect(submitOutput).toBe(`Submitted ${runId}`);

      const leaderboardOutput = await app.run(["leaderboard", "--output", "json"]);
      expect(JSON.parse(leaderboardOutput)).toEqual([
        { rank: 1, model: "openai/gpt-4o-mini", score: 91.2 }
      ]);
    });
  });

  it("has guarded failure path for missing report run", async () => {
    await withCli(async (cwd) => {
      const app = createCliApp({ cwd });
      await app.run(["init"]);

      await expect(app.run(["report", "missing-run"])).rejects.toThrow("[NOT_FOUND] Run not found: missing-run");
    });
  });

  it("validates submit target selection", async () => {
    await withCli(async (cwd) => {
      const app = createCliApp({ cwd });
      await app.run(["init"]);

      await expect(app.run(["submit", "--latest"])).rejects.toThrow("[NOT_FOUND] No runs available for --latest");
      await expect(app.run(["submit"])).rejects.toThrow("[VALIDATION] runId is required unless --latest is used");
    });
  });
});
