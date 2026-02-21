import { appStore } from "../../../state";
import { processQueuedReverificationJobs } from "../../../../reverification-worker";

function isAuthorized(request: Request): boolean {
  const secret = process.env.R2R_REVERIFY_SECRET;
  const incoming = request.headers.get("x-reverify-secret");
  return Boolean(secret && incoming === secret);
}

async function processJobs(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
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

export async function POST(request: Request): Promise<Response> {
  return processJobs(request);
}

export async function GET(request: Request): Promise<Response> {
  return processJobs(request);
}
