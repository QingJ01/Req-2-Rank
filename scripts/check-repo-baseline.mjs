import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

const requiredPaths = [
  "README.md",
  "LICENSE",
  "examples/basic.config.json",
  "examples/advanced.config.json",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md"
];

const missing = requiredPaths.filter((item) => !existsSync(resolve(root, item)));

if (missing.length > 0) {
  throw new Error(`Missing baseline files:\n${missing.map((item) => `- ${item}`).join("\n")}`);
}

console.log("Repository baseline check passed.");
