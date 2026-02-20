import { appStore } from "../../../../state";
import { requireAdminActor } from "../../../../../lib/admin-auth";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdminActor(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, status: auth.status, error: { code: "AUTH_ERROR", message: auth.message } },
      { status: auth.status }
    );
  }

  const url = new URL(request.url);
  const runId = (url.searchParams.get("runId") ?? "").trim();
  if (!runId) {
    return Response.json(
      { ok: false, status: 400, error: { code: "VALIDATION_ERROR", message: "runId is required" } },
      { status: 400 }
    );
  }

  const detail = await appStore.getSubmission(runId);
  if (!detail) {
    return Response.json(
      { ok: false, status: 404, error: { code: "VALIDATION_ERROR", message: "submission not found" } },
      { status: 404 }
    );
  }

  return Response.json({ ok: true, status: 200, data: detail }, { status: 200 });
}
