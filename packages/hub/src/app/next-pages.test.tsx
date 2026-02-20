import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({
    get: (name: string) => name === "hub.lang" ? { value: "zh" } : undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    refresh: () => undefined,
  }),
}));

import RootLayout from "./layout.js";
import LeaderboardPage from "./page.js";
import ModelPage from "./model/[id]/page.js";
import SubmissionPage from "./submission/[id]/page.js";
import WorkbenchPage from "./workbench/page.js";
import AuthPage from "./auth/page.js";
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
    expect(html).toContain("工作台");
    expect(html).toContain("模型");
    expect(html).toContain("openai%2Fgpt-4o-mini");
    expect(html).toContain("child");
  });

  it("renders leaderboard, model and submission pages", async () => {
    const leaderboardHtml = renderToStaticMarkup(await LeaderboardPage());
    expect(leaderboardHtml).toContain("排行榜");
    expect(leaderboardHtml).toContain("校准建议");

    const modelHtml = renderToStaticMarkup(await ModelPage({ params: { id: "openai%2Fgpt-4o-mini" } }));
    expect(modelHtml).toContain("模型详情");

    const submissionHtml = renderToStaticMarkup(await SubmissionPage({ params: { id: "run-layout-1" } }));
    expect(submissionHtml).toContain("提交详情");
    expect(submissionHtml).toContain("维度得分");
    expect(submissionHtml).toContain("证据链");
    expect(submissionHtml).toContain("样本 0");
    expect(submissionHtml).toContain("需求");
    expect(submissionHtml).toContain("提交代码");
    expect(submissionHtml).toContain("复制代码");
    expect(submissionHtml).toContain("language-ts");

    const workbenchHtml = renderToStaticMarkup(await WorkbenchPage({ searchParams: {} }));
    expect(workbenchHtml).toContain("实时工作台");
    expect(workbenchHtml).toContain("实时监控");

    const authHtml = renderToStaticMarkup(await AuthPage({}));
    expect(authHtml).toContain("登录管理");
    expect(authHtml).toContain("使用 GitHub 登录");
  });
});
