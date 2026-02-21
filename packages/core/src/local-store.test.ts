import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
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
      agreementLevel: "high",
      ijaScore: 0.88,
      evidenceChain: {
        timeline: [
          {
            phase: "generate",
            startedAt: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-01-01T00:00:01.000Z",
            model: "system"
          }
        ],
        samples: [{ roundIndex: 0, requirement: "demo", codeSubmission: "ok" }],
        environment: { os: "win32", nodeVersion: "v22", timezone: "UTC" }
      }
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
      agreementLevel: "high",
      ijaScore: 0.75
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
      agreementLevel: "high",
      ijaScore: 0.92
    });

    const runs = await store.listRuns();
    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe("run-2");

    const found = await store.findRunById("run-1");
    expect(found?.targetProvider).toBe("openai");
    expect(found?.ijaScore).toBe(0.75);

    await store.appendCalibration({
      id: "cal-1",
      createdAt: new Date("2026-01-03T00:00:00.000Z").toISOString(),
      recommendedComplexity: "C2",
      reason: "Average score supports C2",
      averageScore: 84,
      sampleSize: 2
    });
    const calibrations = await store.listCalibrations();
    expect(calibrations).toHaveLength(1);
    expect(calibrations[0]?.recommendedComplexity).toBe("C2");
    store.close();
  });

  it("skips malformed json rows instead of crashing run queries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "req2rank-store-"));
    tempDirs.push(dir);

    const dbPath = join(dir, "runs.db");
    const store = new LocalStore(dbPath);
    await store.appendRun({
      id: "run-1",
      createdAt: new Date("2026-01-02T00:00:00.000Z").toISOString(),
      targetProvider: "openai",
      targetModel: "gpt-4o-mini",
      complexity: "C1",
      rounds: 1,
      requirementTitle: "healthy",
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

    const raw = new Database(dbPath);
    raw
      .prepare(
        "INSERT INTO runs (id, created_at, target_provider, target_model, complexity, rounds, requirement_title, overall_score, dimension_scores, ci95, agreement_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        "run-bad",
        new Date("2026-01-01T00:00:00.000Z").toISOString(),
        "openai",
        "gpt-4o-mini",
        "C1",
        1,
        "bad",
        60,
        "{bad-json",
        "[60,61]",
        "low"
      );
    raw.close();

    const runs = await store.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].id).toBe("run-1");
    const foundBad = await store.findRunById("run-bad");
    expect(foundBad).toBeUndefined();
    store.close();
  });
});
