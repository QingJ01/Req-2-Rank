import { appStore } from "../../../state";
import { publicAuthErrorResponse, validatePublicKey } from "../shared";

export async function GET(request: Request): Promise<Response> {
  if (!validatePublicKey(request)) {
    return publicAuthErrorResponse();
  }

  const url = new URL(request.url);
  const entries = await appStore.listLeaderboard({
    limit: url.searchParams.get("limit") ?? 20,
    offset: url.searchParams.get("offset") ?? 0,
    sort: url.searchParams.get("sort") ?? "desc",
    complexity: url.searchParams.get("complexity") ?? "C3",
    dimension: url.searchParams.get("dimension") ?? undefined,
    strategy: url.searchParams.get("strategy") ?? undefined
  });

  return Response.json({ ok: true, status: 200, data: entries }, { status: 200 });
}
