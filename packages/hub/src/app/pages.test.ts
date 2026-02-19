import { describe, expect, it } from "vitest";
import { createSubmissionStore } from "../routes.js";
import { renderLeaderboardPage } from "./renderers/leaderboard.js";
import { renderModelPage } from "./renderers/model.js";
import { renderSubmissionPage } from "./renderers/submission.js";

describe("hub SSR page renderers", () => {
  it("renders leaderboard, model detail, and submission detail pages", async () => {
    const store = createSubmissionStore();
    await store.saveSubmission({
      runId: "run-page-1",
      nonce: "nonce-x",
      targetProvider: "openai",
      targetModel: "gpt-4o-mini",
      overallScore: 91,
      submittedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      evidenceChain: {
        timeline: [
          {
            phase: "generate",
            startedAt: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-01-01T00:00:01.000Z",
            model: "system"
          }
        ],
        samples: [{ roundIndex: 0, requirement: "demo", codeSubmission: "ok" }],
        environment: { os: "win32", nodeVersion: "v22", timezone: "UTC" }
      }
    });

    const leaderboard = await renderLeaderboardPage(store);
    expect(leaderboard).toContain("Req2Rank Leaderboard");
    expect(leaderboard).toContain("openai/gpt-4o-mini");

    const modelPage = await renderModelPage("openai%2Fgpt-4o-mini", store);
    expect(modelPage).toContain("Model: openai/gpt-4o-mini");
    expect(modelPage).toContain("run-page-1");

    const submissionPage = await renderSubmissionPage("run-page-1", store);
    expect(submissionPage).toContain("Submission: run-page-1");
    expect(submissionPage).toContain("Status: pending");
  });
});
