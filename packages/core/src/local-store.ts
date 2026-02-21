import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { CalibrationSnapshot, LocalStoreShape, RunRecord } from "./config.js";

export class LocalStore {
  private readonly filePath: string;
  private db?: Database.Database;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private async getDb(): Promise<Database.Database> {
    if (this.db) {
      return this.db;
    }

    await mkdir(dirname(this.filePath), { recursive: true });
    this.db = new Database(this.filePath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        target_provider TEXT NOT NULL,
        target_model TEXT NOT NULL,
        complexity TEXT NOT NULL,
        rounds INTEGER NOT NULL,
        requirement_title TEXT NOT NULL,
        overall_score REAL NOT NULL,
        dimension_scores TEXT NOT NULL,
        ci95 TEXT NOT NULL,
        agreement_level TEXT NOT NULL,
        ija_score REAL,
        evidence_chain TEXT
      );

      CREATE TABLE IF NOT EXISTS calibrations (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        recommended_complexity TEXT NOT NULL,
        reason TEXT NOT NULL,
        average_score REAL NOT NULL,
        sample_size INTEGER NOT NULL
      );
    `);
    this.ensureColumns(this.db);
    return this.db;
  }

  private ensureColumns(db: Database.Database): void {
    const rows = db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
    const columnNames = new Set(rows.map((row) => row.name));

    if (!columnNames.has("ija_score")) {
      db.exec("ALTER TABLE runs ADD COLUMN ija_score REAL");
    }

    if (!columnNames.has("evidence_chain")) {
      db.exec("ALTER TABLE runs ADD COLUMN evidence_chain TEXT");
    }
  }

  private mapRun(row: Record<string, unknown>): RunRecord {
    const dimensionScores = this.parseJson<Record<string, number>>(row.dimension_scores);
    const ci95 = this.parseJson<[number, number]>(row.ci95);
    if (!dimensionScores || !Array.isArray(ci95) || ci95.length !== 2) {
      throw new Error("Invalid run record JSON payload");
    }

    let evidenceChain: RunRecord["evidenceChain"] | undefined;
    if (row.evidence_chain) {
      evidenceChain = this.parseJson<RunRecord["evidenceChain"]>(row.evidence_chain);
      if (!evidenceChain) {
        throw new Error("Invalid run evidenceChain payload");
      }
    }

    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      targetProvider: String(row.target_provider),
      targetModel: String(row.target_model),
      complexity: String(row.complexity) as RunRecord["complexity"],
      rounds: Number(row.rounds),
      requirementTitle: String(row.requirement_title),
      overallScore: Number(row.overall_score),
      dimensionScores,
      ci95,
      agreementLevel: String(row.agreement_level) as RunRecord["agreementLevel"],
      ijaScore: typeof row.ija_score === "number" ? Number(row.ija_score) : undefined,
      evidenceChain
    };
  }

  private parseJson<T>(value: unknown): T | undefined {
    try {
      return JSON.parse(String(value)) as T;
    } catch {
      return undefined;
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }

  async read(): Promise<LocalStoreShape> {
    const runs = await this.listRuns();
    const calibrations = await this.listCalibrations();
    return { runs, calibrations };
  }

  async appendRun(run: RunRecord): Promise<void> {
    const db = await this.getDb();
    const statement = db.prepare(`
      INSERT INTO runs (
        id,
        created_at,
        target_provider,
        target_model,
        complexity,
        rounds,
        requirement_title,
        overall_score,
        dimension_scores,
        ci95,
        agreement_level,
        ija_score,
        evidence_chain
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    statement.run(
      run.id,
      run.createdAt,
      run.targetProvider,
      run.targetModel,
      run.complexity,
      run.rounds,
      run.requirementTitle,
      run.overallScore,
      JSON.stringify(run.dimensionScores),
      JSON.stringify(run.ci95),
      run.agreementLevel,
      run.ijaScore ?? null,
      run.evidenceChain ? JSON.stringify(run.evidenceChain) : null
    );
  }

  async listRuns(): Promise<RunRecord[]> {
    const db = await this.getDb();
    const statement = db.prepare(
      "SELECT id, created_at, target_provider, target_model, complexity, rounds, requirement_title, overall_score, dimension_scores, ci95, agreement_level, ija_score, evidence_chain FROM runs ORDER BY created_at DESC"
    );
    const rows = statement.all() as Array<Record<string, unknown>>;
    const runs: RunRecord[] = [];
    for (const row of rows) {
      try {
        runs.push(this.mapRun(row));
      } catch {
        continue;
      }
    }
    return runs;
  }

  async findRunById(runId: string): Promise<RunRecord | undefined> {
    const db = await this.getDb();
    const statement = db.prepare(
      "SELECT id, created_at, target_provider, target_model, complexity, rounds, requirement_title, overall_score, dimension_scores, ci95, agreement_level, ija_score, evidence_chain FROM runs WHERE id = ?"
    );
    const row = statement.get(runId) as Record<string, unknown> | undefined;
    if (!row) {
      return undefined;
    }

    try {
      return this.mapRun(row);
    } catch {
      return undefined;
    }
  }

  async appendCalibration(snapshot: CalibrationSnapshot): Promise<void> {
    const db = await this.getDb();
    const statement = db.prepare(`
      INSERT OR REPLACE INTO calibrations (
        id,
        created_at,
        recommended_complexity,
        reason,
        average_score,
        sample_size
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    statement.run(
      snapshot.id,
      snapshot.createdAt,
      snapshot.recommendedComplexity,
      snapshot.reason,
      snapshot.averageScore,
      snapshot.sampleSize
    );
  }

  async listCalibrations(): Promise<CalibrationSnapshot[]> {
    const db = await this.getDb();
    const statement = db.prepare(
      "SELECT id, created_at, recommended_complexity, reason, average_score, sample_size FROM calibrations ORDER BY created_at DESC"
    );
    const rows = statement.all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      recommendedComplexity: String(row.recommended_complexity) as CalibrationSnapshot["recommendedComplexity"],
      reason: String(row.reason),
      averageScore: Number(row.average_score),
      sampleSize: Number(row.sample_size)
    }));
  }
}
