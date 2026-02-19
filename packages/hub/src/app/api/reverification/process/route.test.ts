import { describe, expect, it } from "vitest";
import { POST } from "./route.js";

describe("reverification process route", () => {
  it("rejects unauthorized invocations", async () => {
    const response = await POST(new Request("http://localhost/api/reverification/process", { method: "POST" }));
    expect(response.status).toBe(401);
  });
});
