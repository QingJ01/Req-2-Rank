import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Command } from "commander";
import { normalizeCliError } from "./cli-error.js";
import {
  formatHistoryJson,
  formatHistoryText,
  formatLeaderboardJson,
  formatLeaderboardTable,
  formatLeaderboardText,
  formatReportJson,
  formatReportMarkdownCompact,
  formatReportMarkdown,
  formatReportTextCompact,
  formatReportText
} from "./formatters.js";
import { parseOutputMode, resolveReportOutputMode } from "./output-mode.js";
import {
  CalibrationSnapshot,
  LocalStore,
  PipelineOrchestrator,
  HubClient,
  buildSubmissionPayload,
  calibrateComplexity,
  createHubClient,
  createProvider,
  LLMProvider,
  PipelineCheckpoint,
  PipelineCheckpointStore,
  createPipelineCheckpointKey,
  parseLeaderboardQuery,
  Req2RankConfig,
  runSandboxedCommand,
  runSandboxedSubmission,
  defaultConfig,
  req2rankConfigSchema
} from "@req2rank/core";

const CONFIG_FILENAME = "req2rank.config.json";
const STORE_FILENAME = ".req2rank/runs.db";
const CHECKPOINT_FILENAME = ".req2rank/checkpoints.json";
const LIVE_PROGRESS_FILENAME = ".req2rank/live-progress.json";

export interface CliAppOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  hubClient?: HubClient;
}

type ReportOptions = {
  markdown?: boolean;
  out?: string;
  template?: string;
};

type HistoryOptions = {
  output?: string;
};

type LeaderboardOptions = {
  limit?: string;
  offset?: string;
  sort?: string;
  output?: string;
};

type ExportOptions = {
  latest?: boolean;
  format?: "markdown" | "json";
  out?: string;
  template?: string;
};

type RunOverrides = {
  target?: string;
  complexity?: Req2RankConfig["test"]["complexity"];
  rounds?: string;
};

type CompareOptions = {
  targets: string;
  complexity?: Req2RankConfig["test"]["complexity"];
  rounds?: string;
};

type CalibrateOptions = {
  write?: boolean;
};

type SandboxOptions = {
  image?: string;
  command?: string;
};

class FileCheckpointStore implements PipelineCheckpointStore {
  constructor(private readonly filePath: string) {}

  private async readAll(): Promise<Record<string, PipelineCheckpoint>> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        return {};
      }
      return parsed as Record<string, PipelineCheckpoint>;
    } catch {
      return {};
    }
  }

  private async writeAll(entries: Record<string, PipelineCheckpoint>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(entries, null, 2), "utf-8");
  }

  async load(key: string): Promise<PipelineCheckpoint | undefined> {
    const entries = await this.readAll();
    return entries[key];
  }

  async save(key: string, checkpoint: PipelineCheckpoint): Promise<void> {
    const entries = await this.readAll();
    entries[key] = checkpoint;
    await this.writeAll(entries);
  }

  async clear(key: string): Promise<void> {
    const entries = await this.readAll();
    delete entries[key];
    await this.writeAll(entries);
  }
}

class StubLlmProvider implements LLMProvider {
  id = "stub";
  name = "Stub LLM";

  async chat(params: { messages: Array<{ role: string; content: string }> }): Promise<{
    content: string;
    usage: { promptTokens: number; completionTokens: number };
    latencyMs: number;
  }> {
    const lastMessage = params.messages.at(-1)?.content ?? "";

    if (lastMessage.includes("Convert the reviewed requirement into strict JSON")) {
      return {
        content: JSON.stringify({
          title: "Generated requirement",
          description: "Build a deterministic evaluation fixture.",
          functionalRequirements: [
            {
              id: "FR-1",
              description: "Implement the main feature flow",
              acceptanceCriteria: "Main flow returns expected output",
              priority: "must"
            },
            {
              id: "FR-2",
              description: "Handle invalid input safely",
              acceptanceCriteria: "Invalid input returns structured error",
              priority: "must"
            }
          ],
          constraints: ["Use TypeScript"],
          expectedDeliverables: ["source code", "tests"],
          evaluationGuidance: {
            keyDifferentiators: ["deterministic behavior"],
            commonPitfalls: ["missing validation"],
            edgeCases: ["empty input"]
          },
          selfReviewPassed: true
        }),
        usage: { promptTokens: 10, completionTokens: 20 },
        latencyMs: 5
      };
    }

    if (lastMessage.includes("Audit and improve this requirement draft")) {
      return {
        content: "Reviewed requirement: clear scope, explicit acceptance criteria, and one edge case.",
        usage: { promptTokens: 9, completionTokens: 18 },
        latencyMs: 5
      };
    }

    if (lastMessage.includes("Draft a project requirement document")) {
      return {
        content: "Draft requirement text with concrete and testable requirements.",
        usage: { promptTokens: 8, completionTokens: 16 },
        latencyMs: 5
      };
    }

    if (lastMessage.includes("You are implementing code for a software requirement")) {
      return {
        content: JSON.stringify({ language: "typescript", code: "export function main() { return 'ok'; }" }),
        usage: { promptTokens: 8, completionTokens: 16 },
        latencyMs: 5
      };
    }

    if (lastMessage.includes("Score this code against the requirement")) {
      return {
        content: JSON.stringify({
          functionalCompleteness: 85,
          codeQuality: 82,
          logicAccuracy: 84,
          security: 80,
          engineeringPractice: 83
        }),
        usage: { promptTokens: 7, completionTokens: 14 },
        latencyMs: 5
      };
    }

    return {
      content: "{}",
      usage: { promptTokens: 1, completionTokens: 1 },
      latencyMs: 1
    };
  }
}

function createStubProviderFactory(): typeof createProvider {
  return () => new StubLlmProvider();
}

function applyRunOverrides(config: Req2RankConfig, overrides: RunOverrides): Req2RankConfig {
  const nextConfig: Req2RankConfig = JSON.parse(JSON.stringify(config));

  if (overrides.target) {
    const [provider, model] = overrides.target.split("/");
    if (!provider || !model) {
      throw new Error(`Invalid --target format: ${overrides.target}`);
    }
    nextConfig.target.provider = provider as Req2RankConfig["target"]["provider"];
    nextConfig.target.model = model;
  }

  if (overrides.complexity) {
    nextConfig.test.complexity = overrides.complexity;
  }

  if (overrides.rounds) {
    const parsed = Number.parseInt(overrides.rounds, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid --rounds value: ${overrides.rounds}`);
    }
    nextConfig.test.rounds = parsed;
  }

  return req2rankConfigSchema.parse(nextConfig);
}

function applyEnvOverrides(config: Req2RankConfig, env: Record<string, string | undefined>): Req2RankConfig {
  const nextConfig: Req2RankConfig = JSON.parse(JSON.stringify(config));

  if (env.R2R_TARGET_PROVIDER) {
    nextConfig.target.provider = env.R2R_TARGET_PROVIDER as Req2RankConfig["target"]["provider"];
  }

  if (env.R2R_TARGET_MODEL) {
    nextConfig.target.model = env.R2R_TARGET_MODEL;
  }

  if (env.R2R_TEST_COMPLEXITY) {
    nextConfig.test.complexity = env.R2R_TEST_COMPLEXITY as Req2RankConfig["test"]["complexity"];
  }

  if (env.R2R_TEST_ROUNDS) {
    const rounds = Number.parseInt(env.R2R_TEST_ROUNDS, 10);
    if (!Number.isInteger(rounds) || rounds <= 0) {
      throw new Error(`Invalid R2R_TEST_ROUNDS value: ${env.R2R_TEST_ROUNDS}`);
    }
    nextConfig.test.rounds = rounds;
  }

  return req2rankConfigSchema.parse(nextConfig);
}

async function readConfig(cwd: string): Promise<Req2RankConfig> {
  const filePath = join(cwd, CONFIG_FILENAME);
  const content = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(content) as unknown;
  return req2rankConfigSchema.parse(parsed);
}

async function ensureConfig(cwd: string): Promise<string> {
  const filePath = join(cwd, CONFIG_FILENAME);
  await writeFile(filePath, JSON.stringify(defaultConfig, null, 2), "utf-8");
  return filePath;
}

export function createCliApp(options: CliAppOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const env = { ...process.env, ...(options.env ?? {}) };
  const injectedHubClient = options.hubClient;
  const store = new LocalStore(join(cwd, STORE_FILENAME));
  const checkpointStore = new FileCheckpointStore(join(cwd, CHECKPOINT_FILENAME));
  const progressFilePath = join(cwd, LIVE_PROGRESS_FILENAME);

  type LiveProgressEvent = {
    timestamp: string;
    roundIndex: number;
    totalRounds: number;
    phase: "generate" | "execute" | "evaluate" | "score";
    state: "started" | "completed" | "failed";
    message?: string;
  };

  type LiveProgressSnapshot = {
    status: "idle" | "running" | "completed" | "failed";
    updatedAt: string;
    runId?: string;
    model?: string;
    error?: string;
    events: LiveProgressEvent[];
  };

  async function writeLiveProgress(snapshot: LiveProgressSnapshot): Promise<void> {
    await mkdir(dirname(progressFilePath), { recursive: true });
    await writeFile(progressFilePath, JSON.stringify(snapshot, null, 2), "utf-8");
  }

  function shouldUseStubProviders(config: Req2RankConfig): boolean {
    if (!config.target.apiKey || !config.systemModel.apiKey) {
      return true;
    }

    return config.judges.some((judge) => !judge.apiKey);
  }

  function createRuntimePipeline(config: Req2RankConfig): PipelineOrchestrator {
    if (env.R2R_FORCE_REAL_LLM === "true") {
      return new PipelineOrchestrator();
    }

    if (shouldUseStubProviders(config)) {
      return new PipelineOrchestrator(undefined, undefined, undefined, undefined, createStubProviderFactory());
    }

    return new PipelineOrchestrator();
  }

  async function resolveHubClient(): Promise<HubClient> {
    if (injectedHubClient) {
      return injectedHubClient;
    }

    let config: Req2RankConfig | undefined;
    try {
      config = await readConfig(cwd);
    } catch {
      return createHubClient();
    }
    const envEnabled = env.R2R_HUB_ENABLED ? env.R2R_HUB_ENABLED === "true" : undefined;
    const enabled = envEnabled ?? config.hub?.enabled ?? false;
    if (!enabled) {
      return createHubClient();
    }

    const serverUrl = env.R2R_HUB_SERVER_URL ?? config.hub?.serverUrl;
    const token = env.R2R_HUB_TOKEN ?? config.hub?.token;
    if (!serverUrl || !token) {
      throw new Error("Hub is enabled but serverUrl/token is missing");
    }

    return createHubClient({ serverUrl, token });
  }

  return {
    async run(argv: string[]): Promise<string> {
      let output = "";
      const program = new Command();
      program.exitOverride();
      program.configureOutput({
        writeErr: () => {}
      });

      program.name("req2rank");

      program
        .command("init")
        .description("Initialize config")
        .action(async () => {
          await mkdir(cwd, { recursive: true });
          const filePath = await ensureConfig(cwd);
          output = `Config initialized: ${filePath}`;
        });

      program
        .command("run")
        .description("Run local evaluation pipeline")
        .option("--target <provider/model>")
        .option("--complexity <level>")
        .option("--rounds <count>")
        .action(async (options: RunOverrides) => {
          const envConfig = applyEnvOverrides(await readConfig(cwd), env);
          const config = applyRunOverrides(envConfig, options);
          const pipeline = createRuntimePipeline(config);
          const progress: LiveProgressSnapshot = {
            status: "running",
            updatedAt: new Date().toISOString(),
            model: `${config.target.provider}/${config.target.model}`,
            events: []
          };
          let writeQueue = Promise.resolve();
          const persist = (): void => {
            writeQueue = writeQueue.then(() => writeLiveProgress(progress));
          };
          persist();

          let runRecord;
          try {
            runRecord = await pipeline.run({
              config,
              sandbox:
                env.R2R_SANDBOX_ENABLED === "true"
                  ? {
                      enabled: true,
                      strict: env.R2R_SANDBOX_STRICT !== "false",
                       runner: async (code, context) => {
                         const result = await runSandboxedSubmission({
                           code,
                           language: context.language,
                           timeoutMs: env.R2R_SANDBOX_TIMEOUT_MS ? Number(env.R2R_SANDBOX_TIMEOUT_MS) : 60_000,
                           image: env.R2R_SANDBOX_IMAGE
                         });
                         if (!result.passed) {
                           throw new Error(
                             `sandbox round ${context.roundIndex + 1} failed: ${result.stderr || result.stdout || "unknown"}`
                           );
                         }
                       }
                     }
                  : undefined,
              onProgress: (event) => {
                progress.updatedAt = new Date().toISOString();
                progress.events.push(event);
                if (progress.events.length > 120) {
                  progress.events = progress.events.slice(-120);
                }
                persist();
              },
              checkpoint: {
                key: createPipelineCheckpointKey("run", config),
                store: checkpointStore
              }
            });
          } catch (error) {
            progress.status = "failed";
            progress.updatedAt = new Date().toISOString();
            progress.error = error instanceof Error ? error.message : String(error);
            persist();
            await writeQueue;
            throw error;
          }

          progress.status = "completed";
          progress.updatedAt = new Date().toISOString();
          progress.runId = runRecord.id;
          persist();
          await writeQueue;

          await store.appendRun(runRecord);
          output = `Run completed: ${runRecord.id}`;
        });

      program
        .command("compare")
        .description("Run the same benchmark for multiple target models")
        .requiredOption("--targets <provider/model,provider/model,...>")
        .option("--complexity <level>")
        .option("--rounds <count>")
        .action(async (options: CompareOptions) => {
          const targets = options.targets.split(",").map((item) => item.trim()).filter(Boolean);
          if (targets.length < 2) {
            throw new Error("--targets must contain at least two models");
          }

          const baseConfig = applyEnvOverrides(await readConfig(cwd), env);
          const rows: string[] = [];
          for (const target of targets) {
            const config = applyRunOverrides(baseConfig, {
              target,
              complexity: options.complexity,
              rounds: options.rounds
            });
            const pipeline = createRuntimePipeline(config);
            const runRecord = await pipeline.run({
              config,
              checkpoint: {
                key: createPipelineCheckpointKey("compare", config),
                store: checkpointStore
              }
            });
            await store.appendRun(runRecord);
            rows.push(`${target} => ${runRecord.overallScore} (${runRecord.id})`);
          }

          output = rows.join("\n");
        });

      program
        .command("history")
        .description("Show local run history")
        .option("--output <text|json>")
        .action(async (options: HistoryOptions) => {
          const outputMode = parseOutputMode(options.output, {
            defaultMode: "text",
            allowed: ["text", "json"],
            flagName: "--output"
          });

          const runs = await store.listRuns();
          if (outputMode === "json") {
            output = formatHistoryJson(runs);
            return;
          }

          output = formatHistoryText(runs);
        });

      program
        .command("report")
        .description("Show run report")
        .argument("<runId>")
        .option("--markdown")
        .option("--template <default|compact>")
        .option("--out <filePath>")
        .action(async (runId: string, options: ReportOptions) => {
          const run = await store.findRunById(runId);
          if (!run) {
            throw new Error(`Run not found: ${runId}`);
          }
          const outputMode = resolveReportOutputMode(options.markdown);
          const templateMode = parseOutputMode(options.template, {
            defaultMode: "default",
            allowed: ["default", "compact"],
            flagName: "--template"
          });

          if (outputMode === "markdown") {
            output = templateMode === "compact" ? formatReportMarkdownCompact(run) : formatReportMarkdown(run);
          } else {
            output = templateMode === "compact" ? formatReportTextCompact(run) : formatReportText(run);
          }

          if (options.out) {
            await mkdir(dirname(options.out), { recursive: true });
            await writeFile(options.out, output, "utf-8");
          }
        });

      program
        .command("submit")
        .description("Submit a run to leaderboard hub")
        .argument("[runId]")
        .option("--latest")
        .action(async (runId: string | undefined, options: { latest?: boolean }) => {
          const runtimeHubClient = await resolveHubClient();

          if (runId && options.latest) {
            throw new Error("runId cannot be used together with --latest");
          }

          let targetRunId = runId;
          if (options.latest) {
            const latest = (await store.listRuns())[0];
            if (!latest) {
              throw new Error("No runs available for --latest");
            }
            targetRunId = latest.id;
          }

          if (!targetRunId) {
            throw new Error("runId is required unless --latest is used");
          }

          const run = await store.findRunById(targetRunId);
          if (!run) {
            throw new Error(`Run not found: ${targetRunId}`);
          }

          const nonceResponse = await runtimeHubClient.requestNonce();

          const payload = buildSubmissionPayload({ run, nonce: nonceResponse.nonce });

          const response = await runtimeHubClient.submit(payload);
          output = response.message;
        });

      program
        .command("leaderboard")
        .description("Fetch leaderboard from hub")
        .option("--limit <count>")
        .option("--offset <count>")
        .option("--sort <asc|desc>")
        .option("--output <text|table|json>")
        .action(async (options: LeaderboardOptions) => {
          const runtimeHubClient = await resolveHubClient();
          const query = parseLeaderboardQuery(
            {
              limit: options.limit,
              offset: options.offset,
              sort: options.sort
            },
            {
              limit: "--limit",
              offset: "--offset",
              sort: "--sort"
            }
          );

          const outputMode = parseOutputMode(options.output, {
            defaultMode: "text",
            allowed: ["text", "table", "json"],
            flagName: "--output"
          });

          const entries = await runtimeHubClient.getLeaderboard(query);
          if (outputMode === "json") {
            output = formatLeaderboardJson(entries);
            return;
          }

          if (outputMode === "table") {
            output = formatLeaderboardTable(entries);
            return;
          }

          const rendered = formatLeaderboardText(entries);
          output = rendered.length > 0 ? rendered : `Leaderboard pending (limit=${query.limit})`;
        });

      program
        .command("export")
        .description("Export run report to a file")
        .argument("[runId]")
        .option("--latest")
        .option("--format <type>")
        .option("--template <default|compact>")
        .option("--out <filePath>")
        .action(async (runId: string | undefined, options: ExportOptions) => {
          if (runId && options.latest) {
            throw new Error("runId cannot be used together with --latest");
          }

          const format = options.format ?? "markdown";
          if (format !== "markdown" && format !== "json") {
            throw new Error(`Invalid --format value: ${options.format}`);
          }

          const templateMode = parseOutputMode(options.template, {
            defaultMode: "default",
            allowed: ["default", "compact"],
            flagName: "--template"
          });

          let targetRunId = runId;
          if (options.latest) {
            const latest = (await store.listRuns())[0];
            if (!latest) {
              throw new Error("No runs available for --latest");
            }
            targetRunId = latest.id;
          }

          if (!targetRunId) {
            throw new Error("runId is required unless --latest is used");
          }

          const outputPath = options.out ?? join(cwd, ".req2rank", "exports", `${targetRunId}.${format === "json" ? "json" : "md"}`);

          const run = await store.findRunById(targetRunId);
          if (!run) {
            throw new Error(`Run not found: ${targetRunId}`);
          }

          const rendered =
            format === "markdown"
              ? templateMode === "compact"
                ? formatReportMarkdownCompact(run)
                : formatReportMarkdown(run)
              : formatReportJson(run);

          await mkdir(dirname(outputPath), { recursive: true });
          await writeFile(outputPath, rendered, "utf-8");
          output = `Exported report: ${outputPath}`;
        });

      program
        .command("calibrate")
        .description("Recommend next complexity from historical run scores")
        .option("--write", "Write recommended complexity to config")
        .action(async (options: CalibrateOptions) => {
          const runs = await store.listRuns();
          const history = runs
            .slice()
            .reverse()
            .map((run) => ({
              score: run.overallScore,
              complexity: (run.complexity === "mixed" ? "C2" : run.complexity) as "C1" | "C2" | "C3" | "C4"
            }));
          const recommendation = calibrateComplexity(history);

          const snapshot: CalibrationSnapshot = {
            id: `cal-${Date.now()}`,
            createdAt: new Date().toISOString(),
            recommendedComplexity: recommendation.recommendedComplexity,
            reason: recommendation.reason,
            averageScore: recommendation.averageScore,
            sampleSize: recommendation.sampleSize
          };
          await store.appendCalibration(snapshot);

          try {
            const runtimeHubClient = await resolveHubClient();
            await runtimeHubClient.submitCalibration({
              recommendedComplexity: snapshot.recommendedComplexity,
              reason: snapshot.reason,
              averageScore: snapshot.averageScore,
              sampleSize: snapshot.sampleSize,
              source: "cli"
            });
          } catch {
            // calibration sync is best-effort; local persistence is the source of truth
          }

          if (options.write) {
            const config = await readConfig(cwd);
            config.test.complexity = recommendation.recommendedComplexity;
            await writeFile(join(cwd, CONFIG_FILENAME), JSON.stringify(config, null, 2), "utf-8");
          }

          output = `${recommendation.recommendedComplexity}: ${recommendation.reason}`;
        });

      program
        .command("sandbox")
        .description("Run automated tests in Docker sandbox")
        .option("--image <image>")
        .option("--command <command>")
        .action(async (options: SandboxOptions) => {
          const command = options.command ? options.command.split(" ").filter(Boolean) : undefined;
          const result = await runSandboxedCommand({ image: options.image, command });
          output = result.stdout || result.stderr || "Sandbox command completed.";
        });

      try {
        await program.parseAsync(["node", "req2rank", ...argv], { from: "node" });
        return output;
      } catch (error) {
        throw normalizeCliError(error);
      } finally {
        store.close();
      }
    }
  };
}
