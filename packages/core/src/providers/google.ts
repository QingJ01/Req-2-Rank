import { ChatParams, ChatResponse, HttpProviderBase, Message } from "./base.js";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

function toGeminiContents(messages: Message[]): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }));
}

export class GoogleProvider extends HttpProviderBase {
  id = "google";
  name = "Google";

  constructor(apiKey: string, baseUrl = "https://generativelanguage.googleapis.com/v1beta") {
    super(apiKey, baseUrl);
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    this.requireApiKey();
    const startedAt = Date.now();

    const response = await this.fetchWithRetry(`${this.baseUrl}/models/${params.model}:generateContent?key=${this.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: toGeminiContents(params.messages),
        generationConfig: {
          temperature: params.temperature,
          maxOutputTokens: params.maxTokens,
          responseMimeType: params.responseFormat === "json" ? "application/json" : "text/plain"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Google request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

    return {
      content,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0
      },
      latencyMs: Date.now() - startedAt
    };
  }
}
