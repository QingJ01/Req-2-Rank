import { describe, expect, it } from "vitest";
import { GET, POST } from "./route.js";

describe("calibration route", () => {
  it("rejects unauthorized requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/calibration", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          recommendedComplexity: "C2",
          reason: "test",
          averageScore: 80,
          sampleSize: 3
        })
      })
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { ok: boolean; error?: { message?: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error?.message).toContain("not authorized");
  });

  it("stores and lists calibration snapshots", async () => {
    const postResponse = await POST(
      new Request("http://localhost/api/calibration", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer dev-token",
          "x-actor-id": "user-1"
        },
        body: JSON.stringify({
          recommendedComplexity: "C3",
          reason: "strong trend",
          averageScore: 90,
          sampleSize: 5,
          source: "cli"
        })
      })
    );

    expect(postResponse.status).toBe(200);
    const postPayload = (await postResponse.json()) as { ok: boolean };
    expect(postPayload.ok).toBe(true);

    const listResponse = await GET(
      new Request("http://localhost/api/calibration?limit=5", {
        headers: {
          authorization: "Bearer dev-token",
          "x-actor-id": "user-1"
        }
      })
    );

    expect(listResponse.status).toBe(200);
    const listPayload = (await listResponse.json()) as {
      ok: boolean;
      data: Array<{ recommendedComplexity: string; reason: string; sampleSize: number }>;
    };
    expect(listPayload.ok).toBe(true);
    expect(listPayload.data.length).toBeGreaterThan(0);
    expect(listPayload.data[0]?.recommendedComplexity).toBe("C3");
    expect(listPayload.data[0]?.reason).toBe("strong trend");
    expect(listPayload.data[0]?.sampleSize).toBe(5);
  });
});
