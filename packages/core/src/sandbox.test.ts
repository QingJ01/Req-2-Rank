import { describe, expect, it } from "vitest";
import { buildDockerSandboxCommand } from "./sandbox.js";

describe("buildDockerSandboxCommand", () => {
  it("builds default docker invocation", () => {
    const args = buildDockerSandboxCommand();
    expect(args.slice(0, 6)).toEqual(["run", "--rm", "--read-only", "--cpus", "1", "--memory"]);
    expect(args).toContain("--network");
    expect(args).toContain("none");
    expect(args).toContain("node:20-alpine");
    expect(args).toContain("pnpm");
    expect(args).toContain("test");
  });

  it("uses explicit workspacePath when provided", () => {
    const args = buildDockerSandboxCommand({ workspacePath: "/tmp/demo-workspace", command: ["node", "--version"] });
    expect(args).toContain("/tmp/demo-workspace:/workspace:ro");
    expect(args).toContain("node");
    expect(args).toContain("--version");
  });
});
