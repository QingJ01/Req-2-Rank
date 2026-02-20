import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route.js";

describe("reverification process route", () => {
  const originalMode = process.env.R2R_REVERIFY_MODE;

  afterEach(() => {
    process.env.R2R_REVERIFY_MODE = originalMode;
  });

  it("rejects unauthorized invocations", async () => {
    const response = await POST(new Request("http://localhost/api/reverification/process", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("allows auto mode invocation from cron header", async () => {
    process.env.R2R_REVERIFY_MODE = "auto";
    const response = await GET(
      new Request("http://localhost/api/reverification/process", {
        headers: {
          "x-vercel-cron": "*/5 * * * *"
        }
      })
    );
    expect(response.status).toBe(200);
  });
});
