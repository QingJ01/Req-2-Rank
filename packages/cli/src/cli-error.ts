export type CliErrorCode = "VALIDATION" | "NOT_FOUND" | "RUNTIME";

export class CliError extends Error {
  readonly code: CliErrorCode;
  readonly detail: string;

  constructor(code: CliErrorCode, detail: string) {
    super(`[${code}] ${detail}`);
    this.code = code;
    this.detail = detail;
  }
}

function inferCodeFromMessage(message: string): CliErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("not found") || lower.includes("no runs available")) {
    return "NOT_FOUND";
  }

  if (
    lower.startsWith("invalid") ||
    lower.includes("required") ||
    lower.includes("must be") ||
    lower.includes("unknown option") ||
    lower.includes("unknown command") ||
    lower.includes("missing required argument") ||
    lower.includes("too many arguments") ||
    lower.includes("cannot be used together")
  ) {
    return "VALIDATION";
  }

  return "RUNTIME";
}

export function normalizeCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof Error) {
    return new CliError(inferCodeFromMessage(error.message), error.message);
  }

  return new CliError("RUNTIME", "Unknown error");
}
