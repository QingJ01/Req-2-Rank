import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalStore } from "./local-store.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("LocalStore", () => {
  it("uses sqlite file format for persistence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "req2rank-store-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "runs.db");

    const store = new LocalStore(dbPath);
    await store.appendRun({
      id: "run-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      targetProvider: "openai",
      targetModel: "gpt-4o-mini",
      complexity: "C1",
      rounds: 1,
      requirementTitle: "demo",
      overallScore: 80,
      dimensionScores: {
        functionalCompleteness: 80,
        codeQuality: 80,
        logicAccuracy: 80,
        security: 80,
        engineeringPractice: 80
      },
      ci95: [78, 82],
      agreementLevel: "high"
    });

    const content = await readFile(dbPath);
    expect(content.subarray(0, 15).toString("utf-8")).toBe("SQLite format 3");
    store.close();
  });

  it("supports append list and find", async () => {
    const dir = await mkdtemp(join(tmpdir(), "req2rank-store-"));
    tempDirs.push(dir);

    const store = new LocalStore(join(dir, "runs.db"));
    await store.appendRun({
      id: "run-1",
      createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      targetProvider: "openai",
      targetModel: "gpt-4o-mini",
      complexity: "C1",
      rounds: 1,
      requirementTitle: "demo-1",
      overallScore: 80,
      dimensionScores: {
        functionalCompleteness: 80,
        codeQuality: 80,
        logicAccuracy: 80,
        security: 80,
        engineeringPractice: 80
      },
      ci95: [78, 82],
      agreementLevel: "high"
    });

    await store.appendRun({
      id: "run-2",
      createdAt: new Date("2026-01-02T00:00:00.000Z").toISOString(),
      targetProvider: "anthropic",
      targetModel: "claude-sonnet-4-20250514",
      complexity: "C2",
      rounds: 2,
      requirementTitle: "demo-2",
      overallScore: 88,
      dimensionScores: {
        functionalCompleteness: 88,
        codeQuality: 88,
        logicAccuracy: 88,
        security: 88,
        engineeringPractice: 88
      },
      ci95: [86, 90],
      agreementLevel: "high"
    });

    const runs = await store.listRuns();
    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe("run-2");

    const found = await store.findRunById("run-1");
    expect(found?.targetProvider).toBe("openai");
    store.close();
  });
});
