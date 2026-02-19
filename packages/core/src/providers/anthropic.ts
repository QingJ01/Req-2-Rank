import { ChatParams, ChatResponse, HttpProviderBase } from "./base.js";

interface AnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export class AnthropicProvider extends HttpProviderBase {
  id = "anthropic";
  name = "Anthropic";

  constructor(apiKey: string, baseUrl = "https://api.anthropic.com/v1") {
    super(apiKey, baseUrl);
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    this.requireApiKey();
    const startedAt = Date.now();

    const system = params.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
    const messages = params.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }));

    const response = await this.fetchWithRetry(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens ?? 2048,
        temperature: params.temperature,
        system: system.length > 0 ? system : undefined,
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as AnthropicMessageResponse;
    const firstTextChunk = data.content?.find((item) => item.type === "text")?.text ?? "";

    return {
      content: firstTextChunk,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0
      },
      latencyMs: Date.now() - startedAt
    };
  }
}
