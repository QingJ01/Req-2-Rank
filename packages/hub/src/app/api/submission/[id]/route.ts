import { AuthError, RouteEnvelope, SubmissionDetail } from "../../../../routes";
import { resolveAuthActorFromRequest } from "../../route-helpers";
import { appStore, appValidate } from "../../../state";

export interface SubmissionRouteInput {
  actorId: string;
  authToken?: string;
  params: { id: string };
}

export async function handleSubmissionRequest(input: SubmissionRouteInput): Promise<RouteEnvelope<SubmissionDetail>> {
  try {
    await appValidate(input.actorId, input.authToken);
    const runId = input.params.id;
    const detail = await appStore.getSubmission(runId);
    if (!detail) {
      return {
        ok: false,
        status: 400,
        error: {
          code: "VALIDATION_ERROR",
          message: `submission not found: ${runId}`
        }
      };
    }

    return {
      ok: true,
      status: 200,
      data: detail
    };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        status: 401,
        error: {
          code: error.code,
          message: error.message
        }
      };
    }

    return {
      ok: false,
      status: 400,
      error: {
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Invalid request"
      }
    };
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await resolveAuthActorFromRequest(request);
  if (auth.error || !auth.actorId) {
    return Response.json(auth.error, { status: auth.error?.status ?? 401 });
  }
  const resolvedParams = await context.params;
  const result = await handleSubmissionRequest({
    actorId: auth.actorId,
    authToken: auth.token,
    params: resolvedParams
  });

  return Response.json(result, { status: result.status });
}
