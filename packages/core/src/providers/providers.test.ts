import { afterEach, describe, expect, it, vi } from "vitest";
import { createProvider } from "./index.js";

describe("provider adapters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates providers for all configured adapter types", () => {
    expect(createProvider({ provider: "openai", apiKey: "k" }).id).toBe("openai");
    expect(createProvider({ provider: "openai-response", apiKey: "k" }).id).toBe("openai");
    expect(createProvider({ provider: "anthropic", apiKey: "k" }).id).toBe("anthropic");
    expect(createProvider({ provider: "gemini", apiKey: "k" }).id).toBe("google");
    expect(
      createProvider({
        provider: "azure-openai",
        apiKey: "k",
        baseUrl: "https://example.openai.azure.com/openai/deployments/gpt-4o-mini"
      }).id
    ).toBe("openai");
    expect(createProvider({ provider: "newapi", apiKey: "k", baseUrl: "https://newapi.example.com/v1" }).id).toBe("openai");
  });

  it("requires baseUrl for azure-openai and newapi", () => {
    expect(() => createProvider({ provider: "azure-openai", apiKey: "k" })).toThrow("Required");
    expect(() => createProvider({ provider: "newapi", apiKey: "k" })).toThrow("Required");
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
    const provider = createProvider({ provider: "gemini", apiKey: "k" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 401, statusText: "Unauthorized" })));

    await expect(
      provider.chat({
        model: "gemini-1.5-pro",
        messages: [{ role: "user", content: "hello" }]
      })
    ).rejects.toThrow("Google request failed: 401 Unauthorized");
  });

  it("supports OpenAI responses API format", async () => {
    const provider = createProvider({ provider: "openai-response", apiKey: "k" });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: "ok-from-responses",
          usage: { input_tokens: 12, output_tokens: 4 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.chat({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hello" }]
    });

    expect(result.content).toBe("ok-from-responses");
    expect(result.usage.promptTokens).toBe(12);
    expect(result.usage.completionTokens).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/responses");
  });
});
