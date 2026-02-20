import { listAdminActionLogs, listCommunityReports } from "../../../../report-store.js";
import { createCsrfToken, csrfCookieHeader, requireAdminActor } from "../../../../lib/admin-auth.js";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdminActor(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, status: auth.status, error: { code: "AUTH_ERROR", message: auth.message } },
      { status: auth.status }
    );
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "all";
  const sortByRaw = url.searchParams.get("sortBy") ?? "createdAt";
  const sortOrderRaw = url.searchParams.get("sortOrder") ?? "desc";
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const offsetRaw = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 20;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0;
  const sortBy = sortByRaw === "status" ? "status" : "createdAt";
  const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";

  const queryResult = await listCommunityReports({
    status: status === "open" || status === "resolved" ? status : "all",
    q,
    sortBy,
    sortOrder,
    limit,
    offset
  });
  const logs = await listAdminActionLogs({ limit: 200 });
  const logsByReport = Object.fromEntries(
    queryResult.items.map((report) => [report.id, logs.filter((item) => item.reportId === report.id)])
  );
  const csrfToken = createCsrfToken();

  const headers = new Headers();
  headers.set("set-cookie", csrfCookieHeader(csrfToken));

  return Response.json(
    {
      ok: true,
      status: 200,
      data: queryResult.items,
      meta: {
        total: queryResult.total,
        limit,
        offset,
        sortBy,
        sortOrder,
        csrfToken,
        logsByReport
      }
    },
    { status: 200, headers }
  );
}
