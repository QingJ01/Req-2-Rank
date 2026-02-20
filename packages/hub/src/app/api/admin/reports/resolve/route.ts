import { appStore } from "../../../../state.js";
import { requireAdminActor } from "../../../../../lib/admin-auth.js";
import { getCommunityReport, resolveCommunityReport } from "../../../../../report-store.js";

interface ResolveReportBody {
  id?: string;
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

  const body = (await request.json()) as ResolveReportBody;
  const id = body.id?.trim();
  if (!id) {
    return Response.json(
      { ok: false, status: 400, error: { code: "VALIDATION_ERROR", message: "id is required" } },
      { status: 400 }
    );
  }

  const report = await getCommunityReport(id);
  if (!report) {
    return Response.json(
      { ok: false, status: 404, error: { code: "VALIDATION_ERROR", message: "report not found" } },
      { status: 404 }
    );
  }

  const resolved = await resolveCommunityReport(id, auth.actorId);
  if (!resolved) {
    return Response.json(
      { ok: false, status: 404, error: { code: "VALIDATION_ERROR", message: "report not found" } },
      { status: 404 }
    );
  }

  let reverification: { status: "queued"; runId: string; reason: "flagged" | "top-score" } | undefined;
  if (body.queueReverification !== false) {
    reverification = await appStore.queueReverification(report.runId, "flagged");
  }

  return Response.json(
    {
      ok: true,
      status: 200,
      data: {
        report: resolved,
        reverification
      }
    },
    { status: 200 }
  );
}
