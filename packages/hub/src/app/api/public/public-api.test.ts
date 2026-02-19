import { describe, expect, it } from "vitest";
import { GET as getPublicLeaderboard } from "./leaderboard/route.js";

describe("public API", () => {
  it("returns leaderboard response shape", async () => {
    const res = await getPublicLeaderboard(new Request("http://localhost/api/public/leaderboard?limit=2"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { ok: boolean; data: unknown[] };
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
  });
});
