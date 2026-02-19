import { z } from "zod";
import { LeaderboardQuery } from "./submitter-types.js";

export const leaderboardQuerySchema = z.object({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  sort: z.enum(["asc", "desc"])
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

  if (limit <= 0) {
    throw new Error(`${labels.limit} must be a positive integer`);
  }
  if (offset < 0) {
    throw new Error(`${labels.offset} must be a non-negative integer`);
  }

  if (sort !== "asc" && sort !== "desc") {
    throw new Error(`Invalid ${labels.sort} value: ${sort}`);
  }

  return leaderboardQuerySchema.parse({ limit, offset, sort });
}
