import { ExtendedLeaderboardQuery, RouteEnvelope, createLeaderboardHandler } from "../../../routes.js";
import { LeaderboardEntry } from "@req2rank/core";
import { parseBearerToken } from "../../../lib/auth.js";
import { appStore, appValidate } from "../../state.js";

export interface LeaderboardRouteInput {
  actorId: string;
  headers: { authorization?: string };
  query: ExtendedLeaderboardQuery;
}

const handler = createLeaderboardHandler(appValidate, appStore);

export async function handleLeaderboardRequest(input: LeaderboardRouteInput): Promise<RouteEnvelope<LeaderboardEntry[]>> {
  return handler({
    actorId: input.actorId,
    authToken: parseBearerToken(input.headers),
    body: input.query
  });
}

export async function GET(request: Request): Promise<Response> {
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const url = new URL(request.url);
  const result = await handleLeaderboardRequest({
    actorId,
    headers: {
      authorization: request.headers.get("authorization") ?? undefined
    },
    query: {
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      complexity: url.searchParams.get("complexity") ?? undefined,
      dimension: url.searchParams.get("dimension") ?? undefined,
      strategy: url.searchParams.get("strategy") ?? undefined
    }
  });

  return Response.json(result, { status: result.status });
}
