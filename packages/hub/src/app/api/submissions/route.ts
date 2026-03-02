import { RouteEnvelope, createSubmitHandler } from "../../../routes";
import { SubmissionRequest, SubmissionResponse } from "@req2rank/core";
import { resolveAuthActorFromRequest } from "../route-helpers";
import { appStore, appValidate } from "../../state";

export interface SubmitRouteInput {
  actorId: string;
  authToken?: string;
  body: SubmissionRequest;
}

const handler = createSubmitHandler(appValidate, appStore);

export async function handleSubmitRequest(input: SubmitRouteInput): Promise<RouteEnvelope<SubmissionResponse>> {
  return handler({
    actorId: input.actorId,
    authToken: input.authToken,
    body: input.body
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as SubmissionRequest;
  const auth = await resolveAuthActorFromRequest(request);
  if (auth.error || !auth.actorId) {
    return Response.json(auth.error, { status: auth.error?.status ?? 401 });
  }
  const result = await handleSubmitRequest({
    actorId: auth.actorId,
    authToken: auth.token,
    body
  });

  return Response.json(result, { status: result.status });
}
