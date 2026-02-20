import { ChatParams, ChatResponse, HttpProviderBase } from "./base.js";

interface OpenAIChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface OpenAIResponsesOutputItem {
  content?: Array<{ type?: string; text?: string }>;
}

interface OpenAIResponsesUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface OpenAIResponses {
  output_text?: string;
  output?: OpenAIResponsesOutputItem[];
  usage?: OpenAIResponsesUsage;
}

type OpenAIProtocol = "chat-completions" | "responses";

interface OpenAIProviderOptions {
  protocol?: OpenAIProtocol;
  authMode?: "bearer" | "api-key";
  defaultQuery?: Record<string, string>;
}

function buildUrl(baseUrl: string, endpoint: string, query?: Record<string, string>): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedEndpoint = endpoint.replace(/^\/+/, "");
  const url = new URL(`${normalizedBase}/${normalizedEndpoint}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function toResponsesInput(messages: ChatParams["messages"]): Array<{ role: string; content: Array<{ type: "input_text"; text: string }> }> {
  return messages.map((message) => ({
    role: message.role,
    content: [{ type: "input_text", text: message.content }]
  }));
}

function extractResponsesContent(data: OpenAIResponses): string {
  if (typeof data.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }

  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || item.type === "text")
      .map((item) => item.text ?? "")
      .join("") ?? ""
  );
}

export class OpenAIProvider extends HttpProviderBase {
  id = "openai";
  name = "OpenAI";
  private readonly protocol: OpenAIProtocol;
  private readonly authMode: "bearer" | "api-key";
  private readonly defaultQuery: Record<string, string> | undefined;

  constructor(apiKey: string, baseUrl = "https://api.openai.com/v1", options: OpenAIProviderOptions = {}) {
    super(apiKey, baseUrl);
    this.protocol = options.protocol ?? "chat-completions";
    this.authMode = options.authMode ?? "bearer";
    this.defaultQuery = options.defaultQuery;
  }

  async chat(params: ChatParams): Promise<ChatResponse> {
    this.requireApiKey();
    const startedAt = Date.now();

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (this.authMode === "api-key") {
      headers["api-key"] = this.apiKey;
    } else {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    if (this.protocol === "responses") {
      const payload = {
        model: params.model,
        input: toResponsesInput(params.messages),
        temperature: params.temperature,
        max_output_tokens: params.maxTokens,
        text:
          params.responseFormat === "json"
            ? {
                format: {
                  type: "json_object"
                }
              }
            : undefined
      };

      const response = await this.fetchWithRetry(buildUrl(this.baseUrl, "responses", this.defaultQuery), {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as OpenAIResponses;
      return {
        content: extractResponsesContent(data),
        usage: {
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0
        },
        latencyMs: Date.now() - startedAt
      };
    }

    const payload = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      response_format: params.responseFormat === "json" ? { type: "json_object" } : undefined
    };

    const response = await this.fetchWithRetry(buildUrl(this.baseUrl, "chat/completions", this.defaultQuery), {
      method: "POST",
      headers,
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
