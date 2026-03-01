import { ExtendedLeaderboardQuery, RouteEnvelope, createLeaderboardHandler } from "../../../routes";
import { LeaderboardEntry } from "@req2rank/core";
import { parseBearerToken } from "../../../lib/auth";
import { appStore, appValidate } from "../../state";

export interface LeaderboardRouteInput {
  actorId: string;
  headers: { authorization?: string };
  params: { complexity: string; dimension?: string };
  query: Omit<ExtendedLeaderboardQuery, "complexity" | "dimension">;
}

const handler = createLeaderboardHandler(appValidate, appStore);

function normalizeSegment(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const decoded = decodeURIComponent(value);
  return decoded === "all" ? undefined : decoded;
}

export async function handleLeaderboardRequest(input: LeaderboardRouteInput): Promise<RouteEnvelope<LeaderboardEntry[]>> {
  return handler({
    actorId: input.actorId,
    authToken: parseBearerToken(input.headers),
    body: {
      ...input.query,
      complexity: normalizeSegment(input.params.complexity),
      dimension: normalizeSegment(input.params.dimension)
    }
  });
}
