import { z } from "zod";
import { AnthropicProvider } from "./anthropic.js";
import { CustomOpenAICompatibleProvider } from "./custom.js";
import { LLMProvider } from "./base.js";
import { GoogleProvider } from "./google.js";
import { OpenAIProvider } from "./openai.js";

const providerTypeSchema = z.enum([
  "openai",
  "openai-response",
  "gemini",
  "anthropic",
  "azure-openai",
  "newapi",
  "google",
  "custom"
]);

export const providerConfigSchema = z
  .object({
    provider: providerTypeSchema,
    apiKey: z.string().min(1),
    baseUrl: z.string().url().optional()
  })
  .superRefine((value, context) => {
    if ((value.provider === "azure-openai" || value.provider === "newapi") && !value.baseUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Required: baseUrl for ${value.provider}`,
        path: ["baseUrl"]
      });
    }
  });

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export function createProvider(config: ProviderConfig): LLMProvider {
  const parsedConfig = providerConfigSchema.parse(config);

  switch (parsedConfig.provider) {
    case "openai":
      return new OpenAIProvider(parsedConfig.apiKey, parsedConfig.baseUrl);
    case "openai-response":
      return new OpenAIProvider(parsedConfig.apiKey, parsedConfig.baseUrl, { protocol: "responses" });
    case "anthropic":
      return new AnthropicProvider(parsedConfig.apiKey, parsedConfig.baseUrl);
    case "gemini":
    case "google":
      return new GoogleProvider(parsedConfig.apiKey, parsedConfig.baseUrl);
    case "azure-openai":
      return new OpenAIProvider(parsedConfig.apiKey, parsedConfig.baseUrl, {
        authMode: "api-key",
        defaultQuery: {
          "api-version": "2024-10-21"
        }
      });
    case "newapi":
      return new OpenAIProvider(parsedConfig.apiKey, parsedConfig.baseUrl);
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
