import { ChatParams, ChatResponse, HttpProviderBase } from "./base.js";

interface OpenAIChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export class OpenAIProvider extends HttpProviderBase {
  id = "openai";
  name = "OpenAI";

  constructor(apiKey: string, baseUrl = "https://api.openai.com/v1") {
    super(apiKey, baseUrl);
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    this.requireApiKey();
    const startedAt = Date.now();

    const payload = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      response_format: params.responseFormat === "json" ? { type: "json_object" } : undefined
    };

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OpenAIChatCompletion;
    return {
      content: data.choices?.[0]?.message?.content ?? "",
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0
      },
      latencyMs: Date.now() - startedAt
    };
  }
}
