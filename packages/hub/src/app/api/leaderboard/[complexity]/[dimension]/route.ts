import { handleLeaderboardRequest, resolveLeaderboardAuth } from "../../shared";

export async function GET(request: Request, context: { params: { complexity: string; dimension: string } }): Promise<Response> {
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const url = new URL(request.url);
  const auth = resolveLeaderboardAuth({ authorization: request.headers.get("authorization") ?? undefined });
  if (auth.error) {
    return Response.json(auth.error, { status: auth.error.status });
  }
  const result = await handleLeaderboardRequest({
    actorId,
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
