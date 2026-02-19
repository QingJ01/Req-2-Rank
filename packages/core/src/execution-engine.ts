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
  try {
    const parsed = JSON.parse(rawResponse) as unknown;
    const fromJson = extractFromJson(parsed);
    if (fromJson) {
      return fromJson;
    }
  } catch {
    // fall through to code-block extraction
  }

  const match = rawResponse.match(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/);
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

    let rawResponse = options.rawResponse;
    if (!rawResponse) {
      if (!options.provider) {
        throw new Error("Execution provider is required when rawResponse is not provided.");
      }

      const executionPrompt = [
        "You are implementing code for a software requirement.",
        "Return code as JSON `{\"language\":\"...\",\"code\":\"...\"}`.",
        "If JSON is not possible, return a single fenced code block.",
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
        temperature: 0.2,
        maxTokens: budget.maxTokens,
        messages: [
          {
            role: "system",
            content: "You generate production-ready code that strictly follows requirements."
          },
          {
            role: "user",
            content: executionPrompt
          }
        ]
      });
      rawResponse = response.content;
    }

    const parsed = parseExecutionResponse(rawResponse);

    return {
      code: parsed.code,
      language: parsed.language,
      timeoutMs: budget.timeoutMs,
      maxTokens: budget.maxTokens
    };
  }
}
