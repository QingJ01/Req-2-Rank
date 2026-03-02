import { RouteErrorEnvelope } from "../../routes";
import { AuthError } from "../../routes";
import { parseBearerAuth, resolveActorIdFromToken } from "../../lib/auth";
import { appTokenStore } from "../state";

const INVALID_FORMAT_MESSAGE = "authorization must be a Bearer token";

export function resolveAuthTokenFromHeaders(headers: { authorization?: string }): {
  token?: string;
  error?: RouteErrorEnvelope;
} {
  const parsed = parseBearerAuth(headers);
  if (parsed.errorCode === "AUTH_INVALID_FORMAT") {
    return {
      error: {
        ok: false,
        status: 401,
        error: {
          code: "AUTH_INVALID_FORMAT",
          message: INVALID_FORMAT_MESSAGE
        }
      }
    };
  }

  return { token: parsed.token };
}

export function resolveAuthTokenFromRequest(request: Request): {
  token?: string;
  error?: RouteErrorEnvelope;
} {
  return resolveAuthTokenFromHeaders({ authorization: request.headers.get("authorization") ?? undefined });
}

export async function resolveAuthActorFromRequest(request: Request): Promise<{
  token?: string;
  actorId?: string;
  error?: RouteErrorEnvelope;
}> {
  const resolved = resolveAuthTokenFromRequest(request);
  if (resolved.error) {
    return { error: resolved.error };
  }

  try {
    const actorId = await resolveActorIdFromToken(appTokenStore, resolved.token);
    return { token: resolved.token, actorId };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: {
          ok: false,
          status: 401,
          error: { code: error.code, message: error.message }
        }
      };
    }
    return {
      error: {
        ok: false,
        status: 400,
        error: { code: "VALIDATION_ERROR", message: error instanceof Error ? error.message : "Invalid request" }
      }
    };
  }
}
