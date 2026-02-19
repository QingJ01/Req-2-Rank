import { appStore } from "../../../../app/state.js";
import { processQueuedReverificationJobs } from "../../../../reverification-worker.js";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.R2R_REVERIFY_SECRET;
  const incoming = request.headers.get("x-reverify-secret");
  if (!secret || incoming !== secret) {
    return Response.json(
      {
        ok: false,
        status: 401,
        error: { code: "AUTH_ERROR", message: "reverification secret mismatch" }
      },
      { status: 401 }
    );
  }

  const result = await processQueuedReverificationJobs(appStore, { maxJobs: 50 });
  return Response.json(
    {
      ok: true,
      status: 200,
      data: result
    },
    { status: 200 }
  );
}
