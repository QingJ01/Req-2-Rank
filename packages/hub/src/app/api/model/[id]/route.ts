import { AuthError, RouteEnvelope, SubmissionDetail } from "../../../../routes";
import { resolveAuthActorFromRequest } from "../../route-helpers";
import { appStore, appValidate } from "../../../state";

export interface ModelDetailResponse {
  model: string;
  submissions: SubmissionDetail[];
}

export interface ModelRouteInput {
  actorId: string;
  authToken?: string;
  params: { id: string };
}

export async function handleModelRequest(input: ModelRouteInput): Promise<RouteEnvelope<ModelDetailResponse>> {
  try {
    await appValidate(input.actorId, input.authToken);
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

export async function GET(_request: Request, context: { params: { id: string } }): Promise<Response> {
  const auth = await resolveAuthActorFromRequest(_request);
  if (auth.error || !auth.actorId) {
    return Response.json(auth.error, { status: auth.error?.status ?? 401 });
  }
  const result = await handleModelRequest({
    actorId: auth.actorId,
    authToken: auth.token,
    params: context.params
  });

  return Response.json(result, { status: result.status });
}
