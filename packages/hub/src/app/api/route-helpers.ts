import { RouteErrorEnvelope } from "../../routes";
import { parseBearerAuth } from "../../lib/auth";

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
