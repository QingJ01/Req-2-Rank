import { afterEach, describe, expect, it } from "vitest";
import { GET, POST } from "./route.js";

describe("reverification process route", () => {
  const originalMode = process.env.R2R_REVERIFY_MODE;
  const originalSecret = process.env.R2R_REVERIFY_SECRET;

  afterEach(() => {
    process.env.R2R_REVERIFY_MODE = originalMode;
    process.env.R2R_REVERIFY_SECRET = originalSecret;
  });

  it("rejects unauthorized invocations", async () => {
    const response = await POST(new Request("http://localhost/api/reverification/process", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("requires shared secret even in auto mode", async () => {
    process.env.R2R_REVERIFY_MODE = "auto";
    process.env.R2R_REVERIFY_SECRET = "secret-1";

    const unauthorized = await GET(
      new Request("http://localhost/api/reverification/process", {
        headers: {
          "x-vercel-cron": "*/5 * * * *"
        }
      })
    );
    expect(unauthorized.status).toBe(401);

    const response = await GET(
      new Request("http://localhost/api/reverification/process", {
        headers: {
          "x-vercel-cron": "*/5 * * * *",
          "x-reverify-secret": "secret-1"
        }
      })
    );
    expect(response.status).toBe(200);
  });
});
