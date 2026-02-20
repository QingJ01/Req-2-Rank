import { describe, expect, it } from "vitest";
import { GET as getPublicLeaderboard } from "./leaderboard/route.js";
import { GET as getPublicLiveStream } from "./live/stream/route.js";

describe("public API", () => {
  it("returns leaderboard response shape", async () => {
    const res = await getPublicLeaderboard(new Request("http://localhost/api/public/leaderboard?limit=2"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { ok: boolean; data: unknown[] };
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
  });

  it("exposes SSE stream for live updates", async () => {
    const res = await getPublicLiveStream(new Request("http://localhost/api/public/live/stream?model=openai%2Fgpt-4o-mini"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    let text = "";
    for (let index = 0; index < 8; index += 1) {
      const chunk = await reader?.read();
      text += new TextDecoder().decode(chunk?.value ?? new Uint8Array());
      if (
        text.includes("event: leaderboard") &&
        text.includes("event: model-submissions") &&
        text.includes("event: pipeline-progress")
      ) {
        break;
      }
    }
    expect(text).toContain("event: leaderboard");
    expect(text).toContain("event: model-submissions");
    expect(text).toContain("event: pipeline-progress");
    await reader?.cancel();
  });
});
