import { handleLeaderboardRequest } from "../../shared";

export async function GET(request: Request, context: { params: { complexity: string; dimension: string } }): Promise<Response> {
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const url = new URL(request.url);
  const result = await handleLeaderboardRequest({
    actorId,
    headers: {
      authorization: request.headers.get("authorization") ?? undefined
    },
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
