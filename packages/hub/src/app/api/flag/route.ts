import { FlagSubmissionRequest, ReverificationResponse, RouteEnvelope, createFlagSubmissionHandler } from "../../../routes.js";
import { parseBearerToken } from "../../../lib/auth.js";
import { appStore, appValidate } from "../../state.js";

export interface FlagRouteInput {
  actorId: string;
  headers: { authorization?: string };
  body: FlagSubmissionRequest;
}

const handler = createFlagSubmissionHandler(appValidate, appStore);

export async function handleFlagRequest(input: FlagRouteInput): Promise<RouteEnvelope<ReverificationResponse>> {
  return handler({
    actorId: input.actorId,
    authToken: parseBearerToken(input.headers),
    body: input.body
  });
}

export async function POST(request: Request): Promise<Response> {
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const body = (await request.json()) as FlagSubmissionRequest;
  const result = await handleFlagRequest({
    actorId,
    headers: {
      authorization: request.headers.get("authorization") ?? undefined
    },
    body
  });

  return Response.json(result, { status: result.status });
}
