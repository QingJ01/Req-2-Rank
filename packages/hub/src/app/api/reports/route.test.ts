import { describe, expect, it } from "vitest";
import { GET, POST } from "./route.js";

describe("community report routes", () => {
  it("accepts report submissions and lists reports", async () => {
    const submit = await POST(
      new Request("http://localhost/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: "run-1", reason: "suspicious score", details: "details" })
      })
    );
    expect(submit.status).toBe(200);

    const list = await GET();
    const payload = (await list.json()) as { ok: boolean; data: Array<{ runId: string }> };
    expect(payload.ok).toBe(true);
    expect(payload.data.some((item) => item.runId === "run-1")).toBe(true);
  });
});
