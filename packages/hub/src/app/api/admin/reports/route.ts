import { listCommunityReports } from "../../../../report-store.js";
import { requireAdminActor } from "../../../../lib/admin-auth.js";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdminActor(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, status: auth.status, error: { code: "AUTH_ERROR", message: auth.message } },
      { status: auth.status }
    );
  }

  const reports = await listCommunityReports();
  return Response.json({ ok: true, status: 200, data: reports }, { status: 200 });
}
