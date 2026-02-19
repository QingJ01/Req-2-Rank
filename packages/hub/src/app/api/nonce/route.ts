import { NonceRequest, RouteEnvelope, createNonceHandler } from "../../../routes.js";
import { parseBearerToken } from "../../../lib/auth.js";
import { appStore, appValidate } from "../../state.js";

export interface NonceRouteInput {
  actorId: string;
  headers: { authorization?: string };
  body: NonceRequest;
}

const handler = createNonceHandler(appValidate, appStore);

export async function handleNonceRequest(input: NonceRouteInput): Promise<RouteEnvelope<{ nonce: string; expiresAt: string }>> {
  return handler({
    actorId: input.actorId,
    authToken: parseBearerToken(input.headers),
    body: input.body
  });
}

export async function POST(request: Request): Promise<Response> {
  const actorId = request.headers.get("x-actor-id") ?? "anonymous";
  const body = (await request.json()) as NonceRequest;
  const result = await handleNonceRequest({
    actorId,
    headers: {
      authorization: request.headers.get("authorization") ?? undefined
    },
    body
  });

  return Response.json(result, { status: result.status });
}
