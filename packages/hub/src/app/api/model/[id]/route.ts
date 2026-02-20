import { RouteEnvelope, SubmissionDetail } from "../../../../routes";
import { parseBearerToken } from "../../../../lib/auth";
import { appStore, appValidate } from "../../../state";

export interface ModelDetailResponse {
  model: string;
  submissions: SubmissionDetail[];
}

export interface ModelRouteInput {
  actorId: string;
  headers: { authorization?: string };
  params: { id: string };
}

export async function handleModelRequest(input: ModelRouteInput): Promise<RouteEnvelope<ModelDetailResponse>> {
  try {
    const authToken = parseBearerToken(input.headers);
    await appValidate(input.actorId, authToken);
    const model = decodeURIComponent(input.params.id);
    const submissions = await appStore.listModelSubmissions(model);

    return {
      ok: true,
      status: 200,
      data: {
        model,
        submissions
      }
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

export async function GET(_request: Request, context: { params: { id: string } }): Promise<Response> {
  const result = await handleModelRequest({
    actorId: _request.headers.get("x-actor-id") ?? "anonymous",
    headers: {
      authorization: _request.headers.get("authorization") ?? undefined
    },
    params: context.params
  });

  return Response.json(result, { status: result.status });
}
