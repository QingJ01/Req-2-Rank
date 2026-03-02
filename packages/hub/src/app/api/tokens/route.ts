import { AuthError } from "../../../routes";
import { parseBearerAuth, resolveGitHubActor } from "../../../lib/auth";
import { resolveSessionActor } from "../../../lib/admin-auth";
import { appTokenStore } from "../../state";

interface TokenIssueRequest {
  label?: string;
  actorIdHint?: string;
}

function normalizeActorHint(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function resolveActorForIssue(request: Request, actorHint?: string): Promise<string> {
  const sessionActor = await resolveSessionActor(request);
  if (sessionActor) {
    if (actorHint && sessionActor.toLowerCase() !== actorHint.toLowerCase()) {
      throw new AuthError("AUTH_ACTOR_MISMATCH", "actor mismatch");
    }
    return sessionActor;
  }

  const parsed = parseBearerAuth({ authorization: request.headers.get("authorization") ?? undefined });
  if (parsed.errorCode) {
    const message = parsed.errorCode === "AUTH_INVALID_FORMAT" ? "authorization must be a Bearer token" : "authorization required";
    throw new AuthError(parsed.errorCode, message);
  }
  if (!parsed.token) {
    throw new AuthError("AUTH_MISSING", "authorization required");
  }

  const identity = await resolveGitHubActor(parsed.token);
  const actorId = identity.login;
  if (actorHint && actorId.toLowerCase() !== actorHint.toLowerCase()) {
    throw new AuthError("AUTH_ACTOR_MISMATCH", "actor mismatch");
  }
  return actorId;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as TokenIssueRequest;
    const actorHint = normalizeActorHint(body?.actorIdHint ?? request.headers.get("x-actor-id"));
    const actorId = await resolveActorForIssue(request, actorHint);
    const issued = await appTokenStore.issueToken(actorId, body?.label);
    return Response.json({ ok: true, status: 200, data: issued }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json(
        { ok: false, status: 401, error: { code: error.code, message: error.message } },
        { status: 401 }
      );
    }
    return Response.json(
      { ok: false, status: 400, error: { code: "VALIDATION_ERROR", message: error instanceof Error ? error.message : "Invalid request" } },
      { status: 400 }
    );
  }
}
