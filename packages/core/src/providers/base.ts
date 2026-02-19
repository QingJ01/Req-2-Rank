export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatParams {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface ChatResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
  latencyMs: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  chat(params: ChatParams): Promise<ChatResponse>;
}

export abstract class HttpProviderBase implements LLMProvider {
  abstract id: string;
  abstract name: string;

  protected readonly apiKey: string;
  protected readonly baseUrl: string;

  protected constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  abstract chat(params: ChatParams): Promise<ChatResponse>;

  protected async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async fetchWithRetry(url: string, init: RequestInit, timeoutMs = 30_000): Promise<Response> {
    let timeoutRetriesLeft = 1;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal
        });

        if (response.status === 429 && attempt < 3) {
          await this.sleep(2 ** attempt * 1000);
          continue;
        }

        return response;
      } catch (error) {
        const timeoutLike = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
        if (timeoutLike && timeoutRetriesLeft > 0) {
          timeoutRetriesLeft -= 1;
          continue;
        }

        throw error;
      } finally {
        clearTimeout(timer);
      }
    }

    throw new Error("Request failed after retry attempts");
  }

  protected requireApiKey(): void {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error(`${this.name} API key is required.`);
    }
  }
}
