import { ProjectRequirement } from "./types.js";
import { LLMProvider } from "./providers/base.js";

export interface ExecutionResult {
  code: string;
  language: string;
  timeoutMs: number;
  maxTokens: number;
}

export interface ExecutionTarget {
  provider: string;
  model: string;
}

export interface ExecutionBudget {
  timeoutMs: number;
  maxTokens: number;
}

export interface ExecuteOptions {
  rawResponse?: string;
  provider?: LLMProvider;
}

const EXECUTION_BUDGETS: Record<ProjectRequirement["metadata"]["complexity"], ExecutionBudget> = {
  C1: { timeoutMs: 30_000, maxTokens: 4_096 },
  C2: { timeoutMs: 60_000, maxTokens: 8_192 },
  C3: { timeoutMs: 120_000, maxTokens: 16_384 },
  C4: { timeoutMs: 180_000, maxTokens: 32_768 }
};

function resolveExecutionMaxTokens(defaultMaxTokens: number): number {
  const overrideRaw = process.env.R2R_EXECUTION_MAX_TOKENS;
  if (!overrideRaw) {
    return defaultMaxTokens;
  }

  const override = Number.parseInt(overrideRaw, 10);
  if (!Number.isFinite(override) || override <= 0) {
    return defaultMaxTokens;
  }

  return override;
}

function extractFromJson(value: unknown): { code: string; language: string } | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.code === "string") {
    return {
      code: record.code,
      language: typeof record.language === "string" ? record.language : "typescript"
    };
  }

  if (Array.isArray(record.files)) {
    const firstFile = record.files[0] as Record<string, unknown> | undefined;
    if (firstFile && typeof firstFile.content === "string") {
      return {
        code: firstFile.content,
        language: typeof firstFile.language === "string" ? firstFile.language : "typescript"
      };
    }
  }

  return undefined;
}

export function parseExecutionResponse(rawResponse: string): { code: string; language: string } {
  const trimmed = rawResponse.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const fromJson = extractFromJson(parsed);
    if (fromJson) {
      return fromJson;
    }
  } catch {
    // fall through to code-block extraction
  }

  const jsonFence = trimmed.match(/```json\r?\n([\s\S]*?)```/i);
  if (jsonFence) {
    try {
      const parsed = JSON.parse(jsonFence[1]) as unknown;
      const fromJson = extractFromJson(parsed);
      if (fromJson) {
        return fromJson;
      }
    } catch {
      // continue to other fallbacks
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const fromJson = extractFromJson(parsed);
      if (fromJson) {
        return fromJson;
      }
    } catch {
      // continue to code block fallback
    }
  }

  const match = trimmed.match(/```([a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)```/);
  if (match) {
    return {
      language: match[1] ?? "text",
      code: match[2].trim()
    };
  }

  throw new Error("Unable to parse execution response");
}

export function resolveExecutionBudget(complexity: ProjectRequirement["metadata"]["complexity"]): ExecutionBudget {
  return EXECUTION_BUDGETS[complexity];
}

export class ExecutionEngine {
  async execute(requirement: ProjectRequirement, target: ExecutionTarget, options: ExecuteOptions = {}): Promise<ExecutionResult> {
    const budget = resolveExecutionBudget(requirement.metadata.complexity);
    const maxTokens = resolveExecutionMaxTokens(budget.maxTokens);

    let rawResponse = options.rawResponse;
    if (!rawResponse) {
      if (!options.provider) {
        throw new Error("Execution provider is required when rawResponse is not provided.");
      }

      const executionPrompt = [
        "You are implementing code for a software requirement.",
        "Do NOT ask for files, repository context, or shell access.",
        "Return complete, standalone code based only on the requirement.",
        "Return code as JSON `{\"language\":\"...\",\"code\":\"...\"}`.",
        "Return ONLY JSON and nothing else.",
        "",
        `Target provider: ${target.provider}`,
        `Target model: ${target.model}`,
        `Requirement title: ${requirement.title}`,
        `Requirement description: ${requirement.description}`,
        "Functional requirements:",
        ...requirement.functionalRequirements.map(
          (item) => `- ${item.id}: ${item.description} | acceptance: ${item.acceptanceCriteria}`
        ),
        "Constraints:",
        ...requirement.constraints.map((item) => `- ${item}`),
        "Expected deliverables:",
        ...requirement.expectedDeliverables.map((item) => `- ${item}`)
      ].join("\n");

      const response = await options.provider.chat({
        model: target.model,
        temperature: 0,
        maxTokens,
        responseFormat: "json",
        messages: [
          {
            role: "system",
            content: "Return only valid JSON with code and language. Do not ask for files or repo context."
          },
          {
            role: "user",
            content: executionPrompt
          }
        ]
      });
      rawResponse = response.content;
    }

    let parsed: { code: string; language: string };
    try {
      parsed = parseExecutionResponse(rawResponse);
    } catch (error) {
      const provider = options.provider;
      const shouldRetry =
        !options.rawResponse &&
        provider &&
        error instanceof Error &&
        error.message === "Unable to parse execution response";
      if (!shouldRetry) {
        throw error;
      }

      const retryPrompt = [
        "You must return ONLY valid JSON.",
        "JSON schema: {\"language\":\"typescript\",\"code\":\"...\"}",
        "Do not include markdown, explanations, or extra keys.",
        "Return raw JSON only.",
        "",
        "Original requirement:",
        `Title: ${requirement.title}`,
        `Description: ${requirement.description}`,
        "Functional requirements:",
        ...requirement.functionalRequirements.map(
          (item) => `- ${item.id}: ${item.description} | acceptance: ${item.acceptanceCriteria}`
        ),
        "Constraints:",
        ...requirement.constraints.map((item) => `- ${item}`),
        "Expected deliverables:",
        ...requirement.expectedDeliverables.map((item) => `- ${item}`)
      ].join("\n");

      const retryResponse = await provider.chat({
        model: target.model,
        temperature: 0,
        maxTokens,
        responseFormat: "json",
        messages: [
          {
            role: "system",
            content: "Return only valid JSON with code and language."
          },
          {
            role: "user",
            content: retryPrompt
          }
        ]
      });

      parsed = parseExecutionResponse(retryResponse.content);
    }

    return {
      code: parsed.code,
      language: parsed.language,
      timeoutMs: budget.timeoutMs,
      maxTokens
    };
  }
}
