import { listCommunityReports, submitCommunityReport } from "../../../report-store";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as { runId?: string; reason?: string; details?: string };
  if (!payload.runId || !payload.reason) {
    return Response.json(
      { ok: false, status: 400, error: { code: "VALIDATION_ERROR", message: "runId and reason are required" } },
      { status: 400 }
    );
  }

  const report = await submitCommunityReport({ runId: payload.runId, reason: payload.reason, details: payload.details });
  return Response.json({ ok: true, status: 200, data: report }, { status: 200 });
}

export async function GET(): Promise<Response> {
  const result = await listCommunityReports();
  return Response.json(
    {
      ok: true,
      status: 200,
      data: result.items,
      meta: {
        total: result.total
      }
    },
    { status: 200 }
  );
}
