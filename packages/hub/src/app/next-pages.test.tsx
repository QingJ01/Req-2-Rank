import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "./layout.js";
import LeaderboardPage from "./page.js";
import ModelPage from "./model/[id]/page.js";
import SubmissionPage from "./submission/[id]/page.js";

describe("next-style pages", () => {
  it("renders root layout shell", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>
    );

    expect(html).toContain("Req2Rank Hub");
    expect(html).toContain("child");
  });

  it("renders leaderboard, model and submission pages", async () => {
    const leaderboardHtml = renderToStaticMarkup(await LeaderboardPage());
    expect(leaderboardHtml).toContain("Leaderboard");

    const modelHtml = renderToStaticMarkup(await ModelPage({ params: { id: "openai%2Fgpt-4o-mini" } }));
    expect(modelHtml).toContain("Model Detail");

    const submissionHtml = renderToStaticMarkup(await SubmissionPage({ params: { id: "run-missing" } }));
    expect(submissionHtml).toContain("Submission Detail");
  });
});
