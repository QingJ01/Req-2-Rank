import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { LocalStoreShape, RunRecord } from "./config.js";

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
        agreement_level TEXT NOT NULL
      );
    `);
    return this.db;
  }

  private mapRun(row: Record<string, unknown>): RunRecord {
    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      targetProvider: String(row.target_provider),
      targetModel: String(row.target_model),
      complexity: String(row.complexity) as RunRecord["complexity"],
      rounds: Number(row.rounds),
      requirementTitle: String(row.requirement_title),
      overallScore: Number(row.overall_score),
      dimensionScores: JSON.parse(String(row.dimension_scores)) as Record<string, number>,
      ci95: JSON.parse(String(row.ci95)) as [number, number],
      agreementLevel: String(row.agreement_level) as RunRecord["agreementLevel"]
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }

  async read(): Promise<LocalStoreShape> {
    const runs = await this.listRuns();
    return { runs };
  }

  async appendRun(run: RunRecord): Promise<void> {
    const db = await this.getDb();
    const statement = db.prepare(`
      INSERT OR REPLACE INTO runs (
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
        agreement_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      run.agreementLevel
    );
  }

  async listRuns(): Promise<RunRecord[]> {
    const db = await this.getDb();
    const statement = db.prepare(
      "SELECT id, created_at, target_provider, target_model, complexity, rounds, requirement_title, overall_score, dimension_scores, ci95, agreement_level FROM runs ORDER BY created_at DESC"
    );
    const rows = statement.all() as Array<Record<string, unknown>>;
    return rows.map((row) => this.mapRun(row));
  }

  async findRunById(runId: string): Promise<RunRecord | undefined> {
    const db = await this.getDb();
    const statement = db.prepare(
      "SELECT id, created_at, target_provider, target_model, complexity, rounds, requirement_title, overall_score, dimension_scores, ci95, agreement_level FROM runs WHERE id = ?"
    );
    const row = statement.get(runId) as Record<string, unknown> | undefined;
    return row ? this.mapRun(row) : undefined;
  }
}
