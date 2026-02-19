import { afterEach, describe, expect, it, vi } from "vitest";
import { createProvider } from "./index.js";

describe("provider adapters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates providers for all configured adapter types", () => {
    expect(createProvider({ provider: "openai", apiKey: "k" }).id).toBe("openai");
    expect(createProvider({ provider: "anthropic", apiKey: "k" }).id).toBe("anthropic");
    expect(createProvider({ provider: "google", apiKey: "k" }).id).toBe("google");
    expect(createProvider({ provider: "custom", apiKey: "k", baseUrl: "http://localhost:11434/v1" }).id).toBe("custom");
  });

  it("retries 429 responses with exponential backoff", async () => {
    const provider = createProvider({ provider: "openai", apiKey: "k" });
    const sleeps: number[] = [];
    ((provider as unknown) as { sleep: (ms: number) => Promise<void> }).sleep = async (ms: number) => {
      sleeps.push(ms);
    };

    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate-limit", { status: 429, statusText: "Too Many Requests" }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.chat({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(result.content).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([1000]);
  });

  it("throws provider specific errors for non-retryable responses", async () => {
    const provider = createProvider({ provider: "google", apiKey: "k" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 401, statusText: "Unauthorized" })));

    await expect(
      provider.chat({
        model: "gemini-1.5-pro",
        messages: [{ role: "user", content: "hello" }]
      })
    ).rejects.toThrow("Google request failed: 401 Unauthorized");
  });
});
