import { NonceRequest, RouteEnvelope, createNonceHandler } from "../../../routes";
import { resolveAuthActorFromRequest } from "../route-helpers";
import { appStore, appValidate } from "../../state";

export interface NonceRouteInput {
  actorId: string;
  authToken?: string;
  body: NonceRequest;
}

const handler = createNonceHandler(appValidate, appStore);

export async function handleNonceRequest(input: NonceRouteInput): Promise<RouteEnvelope<{ nonce: string; expiresAt: string }>> {
  return handler({
    actorId: input.actorId,
    authToken: input.authToken,
    body: input.body
  });
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as NonceRequest;
  const auth = await resolveAuthActorFromRequest(request);
  if (auth.error || !auth.actorId) {
    return Response.json(auth.error, { status: auth.error?.status ?? 401 });
  }
  const result = await handleNonceRequest({
    actorId: auth.actorId,
    authToken: auth.token,
    body
  });

  return Response.json(result, { status: result.status });
}
