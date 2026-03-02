import { FlagSubmissionRequest, ReverificationResponse, RouteEnvelope, createFlagSubmissionHandler } from "../../../routes";
import { resolveAuthTokenFromRequest } from "../route-helpers";
import { appStore, appValidate } from "../../state";

export interface FlagRouteInput {
  actorId: string;
  authToken?: string;
  body: FlagSubmissionRequest;
}

const handler = createFlagSubmissionHandler(appValidate, appStore);

export async function handleFlagRequest(input: FlagRouteInput): Promise<RouteEnvelope<ReverificationResponse>> {
  return handler({
    actorId: input.actorId,
    authToken: input.authToken,
    body: input.body
  });
}

export async function POST(request: Request): Promise<Response> {
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const body = (await request.json()) as FlagSubmissionRequest;
  const auth = resolveAuthTokenFromRequest(request);
  if (auth.error) {
    return Response.json(auth.error, { status: auth.error.status });
  }
  const result = await handleFlagRequest({
    actorId,
    authToken: auth.token,
    body
  });

  return Response.json(result, { status: result.status });
}
