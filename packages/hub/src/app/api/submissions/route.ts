import { RouteEnvelope, createSubmitHandler } from "../../../routes";
import { SubmissionRequest, SubmissionResponse } from "@req2rank/core";
import { resolveAuthTokenFromRequest } from "../route-helpers";
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
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const body = (await request.json()) as SubmissionRequest;
  const auth = resolveAuthTokenFromRequest(request);
  if (auth.error) {
    return Response.json(auth.error, { status: auth.error.status });
  }
  const result = await handleSubmitRequest({
    actorId,
    authToken: auth.token,
    body
  });

  return Response.json(result, { status: result.status });
}
