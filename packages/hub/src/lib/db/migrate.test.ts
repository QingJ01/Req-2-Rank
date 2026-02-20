import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDatabaseUrlForMigrations } from "./migrate.js";

describe("resolveDatabaseUrlForMigrations", () => {
  it("reads R2R_DATABASE_URL from .env when process env is unset", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "req2rank-hub-migrate-"));

    try {
      await writeFile(join(cwd, ".env"), "R2R_DATABASE_URL=postgres://demo:demo@127.0.0.1:5432/r2r\n", "utf-8");
      const env = {} as NodeJS.ProcessEnv;

      const databaseUrl = resolveDatabaseUrlForMigrations({ cwd, env });
      expect(databaseUrl).toBe("postgres://demo:demo@127.0.0.1:5432/r2r");
      expect(env.R2R_DATABASE_URL).toBe("postgres://demo:demo@127.0.0.1:5432/r2r");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
