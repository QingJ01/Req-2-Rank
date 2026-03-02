import { handleLeaderboardRequest } from "../../shared";
import { resolveAuthActorFromRequest } from "../../../route-helpers";

export async function GET(request: Request, context: { params: { complexity: string; dimension: string } }): Promise<Response> {
  const url = new URL(request.url);
  const auth = await resolveAuthActorFromRequest(request);
  if (auth.error || !auth.actorId) {
    return Response.json(auth.error, { status: auth.error?.status ?? 401 });
  }
  const result = await handleLeaderboardRequest({
    actorId: auth.actorId,
    authToken: auth.token,
    params: context.params,
    query: {
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      strategy: url.searchParams.get("strategy") ?? undefined
    }
  });

  return Response.json(result, { status: result.status });
}
