import { describe, expect, it } from "vitest";
import { buildDockerSandboxCommand } from "./sandbox.js";

describe("buildDockerSandboxCommand", () => {
  it("builds default docker invocation", () => {
    const args = buildDockerSandboxCommand();
    expect(args.slice(0, 3)).toEqual(["run", "--rm", "-w"]);
    expect(args).toContain("node:20-alpine");
    expect(args).toContain("pnpm");
    expect(args).toContain("test");
  });
});
