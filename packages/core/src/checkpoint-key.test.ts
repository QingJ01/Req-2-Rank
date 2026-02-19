import { describe, expect, it } from "vitest";
import { Req2RankConfig, defaultConfig } from "./config.js";
import { createPipelineCheckpointKey } from "./checkpoint-key.js";

function cloneConfig(): Req2RankConfig {
  return JSON.parse(JSON.stringify(defaultConfig)) as Req2RankConfig;
}

describe("createPipelineCheckpointKey", () => {
  it("returns deterministic key for identical config", () => {
    const config = cloneConfig();
    const first = createPipelineCheckpointKey("run", config);
    const second = createPipelineCheckpointKey("run", config);

    expect(first).toBe(second);
    expect(first).toContain("run:openai/gpt-4o-mini:");
  });

  it("changes key when judge model changes", () => {
    const left = cloneConfig();
    const right = cloneConfig();
    right.judges[0].model = "gpt-4.1";

    const keyLeft = createPipelineCheckpointKey("run", left);
    const keyRight = createPipelineCheckpointKey("run", right);
    expect(keyLeft).not.toBe(keyRight);
  });
});
