import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface SandboxOptions {
  image?: string;
  workdir?: string;
  command?: string[];
}

export function buildDockerSandboxCommand(options: SandboxOptions = {}): string[] {
  const image = options.image ?? "node:20-alpine";
  const workdir = options.workdir ?? "/workspace";
  const command = options.command ?? ["pnpm", "test"];

  return [
    "run",
    "--rm",
    "-w",
    workdir,
    "-v",
    `${process.cwd()}:${workdir}`,
    image,
    ...command
  ];
}

export async function runSandboxedCommand(options: SandboxOptions = {}): Promise<{ stdout: string; stderr: string }> {
  const args = buildDockerSandboxCommand(options);
  return execFileAsync("docker", args, { encoding: "utf-8" });
}
