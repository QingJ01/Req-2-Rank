import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readmePath = resolve(root, "README.md");
const cliEntryPath = resolve(root, "packages/cli/dist/src/index.js");

if (!existsSync(readmePath)) {
  throw new Error("README.md not found");
}

if (!existsSync(cliEntryPath)) {
  throw new Error("CLI build artifact not found: packages/cli/dist/src/index.js");
}

const readme = readFileSync(readmePath, "utf-8");
const blockMatch = readme.match(/<!-- cli-commands:start -->([\s\S]*?)<!-- cli-commands:end -->/);
if (!blockMatch) {
  throw new Error("README CLI command block markers are missing");
}

const readmeCommands = new Set();
for (const match of blockMatch[1].matchAll(/`req2rank\s+([a-z-]+)/g)) {
  readmeCommands.add(match[1]);
}

const helpRun = spawnSync(process.execPath, [cliEntryPath, "--help"], {
  cwd: root,
  encoding: "utf-8"
});
const helpOutput = `${helpRun.stdout ?? ""}`;

if (!helpOutput.includes("Commands:")) {
  const stderr = `${helpRun.stderr ?? ""}`;
  throw new Error(`Unable to read CLI help output.\n${stderr}`);
}

const helpCommands = new Set();
let inCommandsSection = false;
for (const line of helpOutput.split(/\r?\n/)) {
  if (line.trim() === "Commands:") {
    inCommandsSection = true;
    continue;
  }
  if (!inCommandsSection) {
    continue;
  }
  if (line.trim().length === 0) {
    break;
  }
  const cmdMatch = line.match(/^\s{2}([a-z][a-z-]*)\b/);
  if (!cmdMatch) {
    continue;
  }
  if (cmdMatch[1] !== "help") {
    helpCommands.add(cmdMatch[1]);
  }
}

const missingInReadme = [...helpCommands].filter((item) => !readmeCommands.has(item));
const extraInReadme = [...readmeCommands].filter((item) => !helpCommands.has(item));

if (missingInReadme.length > 0 || extraInReadme.length > 0) {
  const lines = ["README CLI command section is out of sync with CLI help output."];
  if (missingInReadme.length > 0) {
    lines.push(`Missing in README: ${missingInReadme.join(", ")}`);
  }
  if (extraInReadme.length > 0) {
    lines.push(`Extra in README: ${extraInReadme.join(", ")}`);
  }
  throw new Error(lines.join("\n"));
}

console.log("README CLI command sync check passed.");
