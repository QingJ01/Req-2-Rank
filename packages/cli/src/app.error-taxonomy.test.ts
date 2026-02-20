import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCliApp } from "./app.js";
import { CliError } from "./cli-error.js";

describe("cli error taxonomy", () => {
  async function withCli(runTest: (cwd: string) => Promise<void>) {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-cli-errors-"));
    try {
      await runTest(cwd);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  }

  it("maps option validation failures to VALIDATION", async () => {
    await withCli(async (cwd) => {
      const app = createCliApp({ cwd });

      await app.run(["init"]);

      await expect(app.run(["history", "--output", "yaml"])).rejects.toMatchObject({
        code: "VALIDATION",
        detail: "Invalid --output value: yaml"
      } satisfies Partial<CliError>);

      await expect(app.run(["history", "--output", "yaml"])).rejects.toThrow(
        "[VALIDATION] Invalid --output value: yaml"
      );

      await expect(app.run(["history", "--unknown"])).rejects.toMatchObject({
        code: "VALIDATION"
      } satisfies Partial<CliError>);
    });
  });

  it("maps not-found failures to NOT_FOUND", async () => {
    await withCli(async (cwd) => {
      const app = createCliApp({ cwd });

      await app.run(["init"]);

      await expect(app.run(["report", "missing-run"])).rejects.toMatchObject({
        code: "NOT_FOUND",
        detail: "Run not found: missing-run"
      } satisfies Partial<CliError>);
    });
  });

  it("maps unexpected failures to RUNTIME", async () => {
    await withCli(async (cwd) => {
      const app = createCliApp({
        cwd,
        hubClient: {
          requestNonce: async () => ({ nonce: "nonce-1", expiresAt: new Date().toISOString() }),
          submit: async () => {
            throw new Error("Hub unavailable");
          },
          getLeaderboard: async () => [],
          submitCalibration: async () => ({ ok: true })
        }
      });

      await app.run(["init"]);
      const runOutput = await app.run(["run"]);
      const runId = runOutput.replace("Run completed: ", "").trim();

      await expect(app.run(["submit", runId])).rejects.toMatchObject({
        code: "RUNTIME",
        detail: "Hub unavailable"
      } satisfies Partial<CliError>);
    });
  });
});
