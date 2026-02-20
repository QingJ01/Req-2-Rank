export type LeaderboardAggregationStrategy = "mean" | "best" | "latest";

export function resolveLeaderboardStrategy(value: string | undefined): LeaderboardAggregationStrategy {
  if (value === "best" || value === "latest") {
    return value;
  }
  return "mean";
}
