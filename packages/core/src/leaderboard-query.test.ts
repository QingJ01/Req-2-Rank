import { describe, expect, it } from "vitest";
import { parseLeaderboardQuery } from "./leaderboard-query.js";

describe("parseLeaderboardQuery", () => {
  it("applies defaults for empty input", () => {
    const query = parseLeaderboardQuery({});
    expect(query).toEqual({ limit: 10, offset: 0, sort: "desc" });
  });

  it("normalizes numeric strings", () => {
    const query = parseLeaderboardQuery({ limit: "2", offset: "1", sort: "asc" });
    expect(query).toEqual({ limit: 2, offset: 1, sort: "asc" });
  });

  it("throws labeled errors for invalid values", () => {
    expect(() =>
      parseLeaderboardQuery(
        { limit: "2x" },
        {
          limit: "--limit",
          offset: "--offset",
          sort: "--sort"
        }
      )
    ).toThrow("Invalid --limit value: 2x");
  });

  it("enforces limit and offset boundaries", () => {
    expect(() => parseLeaderboardQuery({ limit: 0 })).toThrow("limit must be a positive integer");
    expect(() => parseLeaderboardQuery({ offset: -1 })).toThrow("offset must be a non-negative integer");
  });
});
