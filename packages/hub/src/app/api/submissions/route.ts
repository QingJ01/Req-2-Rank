import { RouteEnvelope, createSubmitHandler } from "../../../routes";
import { SubmissionRequest, SubmissionResponse } from "@req2rank/core";
import { parseBearerToken } from "../../../lib/auth";
import { appStore, appValidate } from "../../state";

export interface SubmitRouteInput {
  actorId: string;
  headers: { authorization?: string };
  body: SubmissionRequest;
}

const handler = createSubmitHandler(appValidate, appStore);

export async function handleSubmitRequest(input: SubmitRouteInput): Promise<RouteEnvelope<SubmissionResponse>> {
  return handler({
    actorId: input.actorId,
    authToken: parseBearerToken(input.headers),
    body: input.body
  });
}

export async function POST(request: Request): Promise<Response> {
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const body = (await request.json()) as SubmissionRequest;
  const result = await handleSubmitRequest({
    actorId,
    headers: {
      authorization: request.headers.get("authorization") ?? undefined
    },
    body
  });

  return Response.json(result, { status: result.status });
}
