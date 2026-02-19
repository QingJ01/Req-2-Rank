export interface OutputModeConfig<T extends string> {
  defaultMode: T;
  allowed: readonly T[];
  flagName: string;
}

export function parseOutputMode<T extends string>(
  rawValue: string | undefined,
  config: OutputModeConfig<T>
): T {
  if (rawValue === undefined) {
    return config.defaultMode;
  }

  const mode = rawValue as T;
  if (!config.allowed.includes(mode)) {
    throw new Error(`Invalid ${config.flagName} value: ${rawValue}`);
  }

  return mode;
}

export function resolveReportOutputMode(markdown: boolean | undefined): "text" | "markdown" {
  return markdown ? "markdown" : "text";
}
