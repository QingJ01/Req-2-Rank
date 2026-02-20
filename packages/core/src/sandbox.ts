import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface SandboxOptions {
  image?: string;
  workdir?: string;
  workspacePath?: string;
  command?: string[];
  timeoutMs?: number;
  cpus?: number;
  memoryMb?: number;
  pidsLimit?: number;
  network?: "none" | "bridge";
  readOnly?: boolean;
}

export function buildDockerSandboxCommand(options: SandboxOptions = {}): string[] {
  const image = options.image ?? "node:20-alpine";
  const workdir = options.workdir ?? "/workspace";
  const workspacePath = options.workspacePath ?? process.cwd();
  const command = options.command ?? ["pnpm", "test"];
  const cpus = options.cpus ?? 1;
  const memoryMb = options.memoryMb ?? 512;
  const pidsLimit = options.pidsLimit ?? 128;
  const network = options.network ?? "none";
  const readOnly = options.readOnly ?? true;

  const args = [
    "run",
    "--rm",
    ...(readOnly ? ["--read-only"] : []),
    "--cpus",
    String(cpus),
    "--memory",
    `${memoryMb}m`,
    "--pids-limit",
    String(pidsLimit),
    "--network",
    network,
    "-w",
    workdir,
    "-v",
    `${workspacePath}:${workdir}`,
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=64m",
    image,
    ...command
  ];

  return args;
}

export async function runSandboxedCommand(options: SandboxOptions = {}): Promise<{ stdout: string; stderr: string }> {
  const args = buildDockerSandboxCommand(options);
  return execFileAsync("docker", args, {
    encoding: "utf-8",
    timeout: options.timeoutMs ?? 60_000,
    killSignal: "SIGKILL"
  });
}

export interface SandboxedSubmissionInput {
  code: string;
  language: string;
  timeoutMs?: number;
  image?: string;
}

export interface SandboxedSubmissionResult {
  passed: boolean;
  command: string[];
  workspacePath: string;
  stdout: string;
  stderr: string;
}

function extensionForLanguage(language: string): string {
  const normalized = language.toLowerCase();
  if (normalized.includes("typescript") || normalized === "ts") {
    return "ts";
  }
  if (normalized.includes("javascript") || normalized === "js") {
    return "js";
  }
  return "txt";
}

function buildValidationCommand(fileName: string, extension: string): string[] {
  if (extension === "js") {
    return ["node", "--check", fileName];
  }

  if (extension === "ts") {
    return [
      "node",
      "-e",
      [
        "const fs = require('node:fs');",
        `const src = fs.readFileSync('${fileName}', 'utf8');`,
        "if (!src || src.trim().length === 0) throw new Error('empty submission');",
        "if (!/export|function|const|class/.test(src)) throw new Error('submission lacks executable constructs');"
      ].join(" ")
    ];
  }

  return [
    "node",
    "-e",
    [
      "const fs = require('node:fs');",
      `const src = fs.readFileSync('${fileName}', 'utf8');`,
      "if (!src || src.trim().length === 0) throw new Error('empty submission');"
    ].join(" ")
  ];
}

export async function runSandboxedSubmission(input: SandboxedSubmissionInput): Promise<SandboxedSubmissionResult> {
  const workspacePath = await mkdtemp(join(tmpdir(), "req2rank-sandbox-"));
  const extension = extensionForLanguage(input.language);
  const fileName = `submission.${extension}`;
  const filePath = join(workspacePath, fileName);

  try {
    await writeFile(filePath, input.code, "utf8");

    const command = buildValidationCommand(fileName, extension);
    const result = await runSandboxedCommand({
      image: input.image,
      timeoutMs: input.timeoutMs,
      workspacePath,
      workdir: "/workspace",
      command,
      network: "none",
      readOnly: true
    });

    return {
      passed: true,
      command,
      workspacePath,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      passed: false,
      command: buildValidationCommand(fileName, extension),
      workspacePath,
      stdout: "",
      stderr: message
    };
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
}
