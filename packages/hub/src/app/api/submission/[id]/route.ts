import { RouteEnvelope, SubmissionDetail } from "../../../../routes";
import { parseBearerToken } from "../../../../lib/auth";
import { appStore, appValidate } from "../../../state";

export interface SubmissionRouteInput {
  actorId: string;
  headers: { authorization?: string };
  params: { id: string };
}

export async function handleSubmissionRequest(input: SubmissionRouteInput): Promise<RouteEnvelope<SubmissionDetail>> {
  try {
    const authToken = parseBearerToken(input.headers);
    await appValidate(input.actorId, authToken);
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
    if (error instanceof Error && error.message.toLowerCase().includes("authorized")) {
      return {
        ok: false,
        status: 401,
        error: {
          code: "AUTH_ERROR",
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

export async function GET(request: Request, context: { params: { id: string } }): Promise<Response> {
  const result = await handleSubmissionRequest({
    actorId: request.headers.get("x-actor-id") ?? "anonymous",
    headers: {
      authorization: request.headers.get("authorization") ?? undefined
    },
    params: context.params
  });

  return Response.json(result, { status: result.status });
}
