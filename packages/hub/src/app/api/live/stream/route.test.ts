import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route.js";

describe("live stream proxy route", () => {
  const originalPublicApiKey = process.env.R2R_PUBLIC_API_KEY;

  afterEach(() => {
    process.env.R2R_PUBLIC_API_KEY = originalPublicApiKey;
    vi.restoreAllMocks();
  });

  it("forwards request to public live stream with api key", async () => {
    process.env.R2R_PUBLIC_API_KEY = "pub-key";

    const upstreamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("event: ping\ndata: {}\n\n"));
      }
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(upstreamBody, { status: 200, headers: { "content-type": "text/event-stream" } }));

    const response = await GET(new Request("http://localhost/api/live/stream?model=openai%2Fgpt-4o-mini&limit=10"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [targetUrl, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(targetUrl).toContain("/api/public/live/stream?");
    expect(targetUrl).toContain("model=openai%2Fgpt-4o-mini");
    expect(targetUrl).toContain("limit=10");

    const headers = options.headers as Headers;
    expect(headers.get("x-api-key")).toBe("pub-key");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
  });
});
