import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "./layout.js";
import LeaderboardPage from "./page.js";
import ModelPage from "./model/[id]/page.js";
import SubmissionPage from "./submission/[id]/page.js";
import { appStore } from "./state.js";

describe("next-style pages", () => {
  it("renders root layout shell", async () => {
    await appStore.saveSubmission({
      runId: "run-layout-1",
      nonce: "nonce-layout",
      targetProvider: "openai",
      targetModel: "gpt-4o-mini",
      overallScore: 90,
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
        samples: [{ roundIndex: 0, requirement: "demo", codeSubmission: "export const ok = true;" }],
        environment: { os: "win32", nodeVersion: "v22", timezone: "UTC" }
      }
    });

    const html = renderToStaticMarkup(await RootLayout({ children: <div>child</div> }));

    expect(html).toContain("Req2Rank Hub");
    expect(html).toContain("Models");
    expect(html).toContain("openai%2Fgpt-4o-mini");
    expect(html).toContain("child");
  });

  it("renders leaderboard, model and submission pages", async () => {
    const leaderboardHtml = renderToStaticMarkup(await LeaderboardPage());
    expect(leaderboardHtml).toContain("Leaderboard");
    expect(leaderboardHtml).toContain("Calibration Recommendations");

    const modelHtml = renderToStaticMarkup(await ModelPage({ params: { id: "openai%2Fgpt-4o-mini" } }));
    expect(modelHtml).toContain("Model Detail");

    const submissionHtml = renderToStaticMarkup(await SubmissionPage({ params: { id: "run-layout-1" } }));
    expect(submissionHtml).toContain("Submission Detail");
    expect(submissionHtml).toContain("Dimension Scores");
    expect(submissionHtml).toContain("Evidence Chain");
    expect(submissionHtml).toContain("Sample 0");
    expect(submissionHtml).toContain("Requirement");
    expect(submissionHtml).toContain("Code Submission");
    expect(submissionHtml).toContain("Copy code");
    expect(submissionHtml).toContain("language-ts");
  });
});
