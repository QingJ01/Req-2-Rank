import { z } from "zod";
import { LeaderboardQuery } from "./submitter-types.js";

export const leaderboardQuerySchema = z.object({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  sort: z.enum(["asc", "desc"]),
  complexity: z.enum(["C1", "C2", "C3", "C4", "mixed"]).optional(),
  dimension: z
    .enum(["functionalCompleteness", "codeQuality", "logicAccuracy", "security", "engineeringPractice"])
    .optional()
});

export type LeaderboardQueryNormalized = z.infer<typeof leaderboardQuerySchema>;

export interface LeaderboardQueryFieldLabels {
  limit: string;
  offset: string;
  sort: string;
}

const DEFAULT_LABELS: LeaderboardQueryFieldLabels = {
  limit: "limit",
  offset: "offset",
  sort: "sort"
};

function parseIntegerField(
  value: number | string | undefined,
  defaultValue: number,
  label: string
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`Invalid ${label} value: ${value}`);
    }
    return value;
  }

  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Invalid ${label} value: ${value}`);
  }

  return Number.parseInt(value, 10);
}

export function parseLeaderboardQuery(
  input: LeaderboardQuery,
  labels: LeaderboardQueryFieldLabels = DEFAULT_LABELS
): LeaderboardQueryNormalized {
  const limit = parseIntegerField(input.limit, 10, labels.limit);
  const offset = parseIntegerField(input.offset, 0, labels.offset);
  const sort = input.sort ?? "desc";
  const complexity = input.complexity;
  const dimension = input.dimension;

  if (limit <= 0) {
    throw new Error(`${labels.limit} must be a positive integer`);
  }
  if (offset < 0) {
    throw new Error(`${labels.offset} must be a non-negative integer`);
  }

  if (sort !== "asc" && sort !== "desc") {
    throw new Error(`Invalid ${labels.sort} value: ${sort}`);
  }

  if (complexity !== undefined && complexity !== "C1" && complexity !== "C2" && complexity !== "C3" && complexity !== "C4" && complexity !== "mixed") {
    throw new Error(`Invalid complexity value: ${complexity}`);
  }

  if (
    dimension !== undefined &&
    dimension !== "functionalCompleteness" &&
    dimension !== "codeQuality" &&
    dimension !== "logicAccuracy" &&
    dimension !== "security" &&
    dimension !== "engineeringPractice"
  ) {
    throw new Error(`Invalid dimension value: ${dimension}`);
  }

  return leaderboardQuerySchema.parse({ limit, offset, sort, complexity, dimension });
}
