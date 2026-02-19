import { ProjectRequirement } from "./types.js";

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

    const fallbackCode = [
      `// provider: ${target.provider}`,
      `// model: ${target.model}`,
      `// requirement: ${requirement.title}`,
      "export function main() {",
      "  return 'ok';",
      "}"
    ].join("\n");

    const rawResponse = options.rawResponse ?? JSON.stringify({ language: "typescript", code: fallbackCode });
    const parsed = parseExecutionResponse(rawResponse);

    return {
      code: parsed.code,
      language: parsed.language,
      timeoutMs: budget.timeoutMs,
      maxTokens: budget.maxTokens
    };
  }
}
