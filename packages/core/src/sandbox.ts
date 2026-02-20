import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface SandboxOptions {
  image?: string;
  workdir?: string;
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
  const command = options.command ?? ["pnpm", "test"];
  const cpus = options.cpus ?? 1;
  const memoryMb = options.memoryMb ?? 512;
  const pidsLimit = options.pidsLimit ?? 128;
  const network = options.network ?? "none";
  const readOnly = options.readOnly ?? true;

  const args = [
    "run",
    "--rm",
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
    `${process.cwd()}:${workdir}`,
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=64m",
    image,
    ...command
  ];

  if (readOnly) {
    args.splice(2, 0, "--read-only");
  }

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
