import { appStore } from "../../../state.js";

function validatePublicKey(request: Request): boolean {
  const configured = process.env.R2R_PUBLIC_API_KEY;
  if (!configured) {
    return true;
  }
  return request.headers.get("x-api-key") === configured;
}

export async function GET(request: Request): Promise<Response> {
  if (!validatePublicKey(request)) {
    return Response.json({ ok: false, status: 401, error: { code: "AUTH_ERROR", message: "invalid api key" } }, { status: 401 });
  }

  const url = new URL(request.url);
  const entries = await appStore.listLeaderboard({
    limit: url.searchParams.get("limit") ?? 20,
    offset: url.searchParams.get("offset") ?? 0,
    sort: url.searchParams.get("sort") ?? "desc",
    complexity: url.searchParams.get("complexity") ?? undefined,
    dimension: url.searchParams.get("dimension") ?? undefined,
    strategy: url.searchParams.get("strategy") ?? undefined
  });

  return Response.json({ ok: true, status: 200, data: entries }, { status: 200 });
}
