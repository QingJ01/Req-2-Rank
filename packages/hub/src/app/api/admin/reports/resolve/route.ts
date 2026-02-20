import { appStore } from "../../../../state.js";
import { requireAdminActor, validateAdminCsrf } from "../../../../../lib/admin-auth.js";
import { getCommunityReport, logAdminAction, resolveCommunityReport } from "../../../../../report-store.js";

interface ResolveReportBody {
  id?: string;
  ids?: string[];
  queueReverification?: boolean;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAdminActor(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, status: auth.status, error: { code: "AUTH_ERROR", message: auth.message } },
      { status: auth.status }
    );
  }

  if (!validateAdminCsrf(request)) {
    return Response.json(
      { ok: false, status: 403, error: { code: "AUTH_ERROR", message: "csrf validation failed" } },
      { status: 403 }
    );
  }

  const body = (await request.json()) as ResolveReportBody;
  const ids = (Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (ids.length === 0) {
    return Response.json(
      { ok: false, status: 400, error: { code: "VALIDATION_ERROR", message: "id or ids is required" } },
      { status: 400 }
    );
  }

  const queueReverification = body.queueReverification !== false;
  const resolvedReports: Array<Awaited<ReturnType<typeof resolveCommunityReport>>> = [];
  const queuedReverification: Array<{ status: "queued"; runId: string; reason: "flagged" | "top-score" }> = [];

  for (const id of ids) {
    const report = await getCommunityReport(id);
    if (!report) {
      return Response.json(
        { ok: false, status: 404, error: { code: "VALIDATION_ERROR", message: `report not found: ${id}` } },
        { status: 404 }
      );
    }

    const resolved = await resolveCommunityReport(id, auth.actorId);
    if (!resolved) {
      return Response.json(
        { ok: false, status: 404, error: { code: "VALIDATION_ERROR", message: `report not found: ${id}` } },
        { status: 404 }
      );
    }

    resolvedReports.push(resolved);

    let reverification: { status: "queued"; runId: string; reason: "flagged" | "top-score" } | undefined;
    if (queueReverification) {
      reverification = await appStore.queueReverification(report.runId, "flagged");
      queuedReverification.push(reverification);
    }

    await logAdminAction({
      actorId: auth.actorId,
      action: "resolve-report",
      reportId: id,
      runId: report.runId,
      queueReverification,
      metadata: {
        queueReverification,
        reverification: reverification ? { runId: reverification.runId, reason: reverification.reason } : null
      }
    });
  }

  return Response.json(
    {
      ok: true,
      status: 200,
      data: {
        reports: resolvedReports,
        reverification: queuedReverification
      }
    },
    { status: 200 }
  );
}
