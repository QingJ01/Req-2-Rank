import { z } from "zod";
import { AnthropicProvider } from "./anthropic.js";
import { CustomOpenAICompatibleProvider } from "./custom.js";
import { LLMProvider } from "./base.js";
import { GoogleProvider } from "./google.js";
import { OpenAIProvider } from "./openai.js";

export const providerConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic", "google", "custom"]),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional()
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export function createProvider(config: ProviderConfig): LLMProvider {
  const parsedConfig = providerConfigSchema.parse(config);

  switch (parsedConfig.provider) {
    case "openai":
      return new OpenAIProvider(parsedConfig.apiKey, parsedConfig.baseUrl);
    case "anthropic":
      return new AnthropicProvider(parsedConfig.apiKey, parsedConfig.baseUrl);
    case "google":
      return new GoogleProvider(parsedConfig.apiKey, parsedConfig.baseUrl);
    case "custom":
      return new CustomOpenAICompatibleProvider(parsedConfig.apiKey, parsedConfig.baseUrl ?? "http://localhost:11434/v1");
    default:
      throw new Error("Unsupported provider");
  }
}

export * from "./base.js";
export * from "./openai.js";
export * from "./anthropic.js";
export * from "./google.js";
export * from "./custom.js";
