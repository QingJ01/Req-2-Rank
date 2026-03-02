import { AuthError, ValidationHook } from "../routes";
import { resolveGithubOAuthSession } from "./github-oauth-session";
import { ActorTokenStore } from "./token-store";

export interface HeaderMap {
  authorization?: string;
}

export function parseBearerAuth(headers: HeaderMap): { token?: string; errorCode?: AuthError["code"] } {
  const value = headers.authorization;
  if (!value) {
    return { errorCode: "AUTH_MISSING" };
  }

  const [scheme, token] = value.trim().split(/\s+/, 2);
  if (!scheme || !token) {
    return { errorCode: "AUTH_INVALID_FORMAT" };
  }

  if (scheme.toLowerCase() !== "bearer") {
    return { errorCode: "AUTH_INVALID_FORMAT" };
  }

  return { token };
}

export function parseBearerToken(headers: HeaderMap): string | undefined {
  const parsed = parseBearerAuth(headers);
  return parsed.token;
}

interface GitHubUserResponse {
  id: number;
  login: string;
}

export interface GitHubActorIdentity {
  login: string;
  id: number;
}

export async function resolveGitHubActor(authToken: string, fetchImpl: typeof fetch = fetch): Promise<GitHubActorIdentity> {
  const response = await fetchImpl("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "User-Agent": "req2rank-hub"
    }
  });

  if (!response.ok) {
    throw new AuthError("AUTH_TOKEN_NOT_FOUND", "not authorized");
  }

  const user = (await response.json()) as GitHubUserResponse;
  if (!user.login) {
    throw new AuthError("AUTH_TOKEN_NOT_FOUND", "not authorized");
  }

  return { login: user.login, id: user.id };
}

export function createGitHubAuthValidator(fetchImpl: typeof fetch = fetch): ValidationHook {
  return async (actorId: string, authToken?: string) => {
    if (!authToken) {
      throw new AuthError("AUTH_MISSING", "authorization required");
    }

    const identity = await resolveGitHubActor(authToken, fetchImpl);
    if (actorId !== identity.login && actorId !== String(identity.id)) {
      throw new AuthError("AUTH_ACTOR_MISMATCH", "not authorized");
    }
  };
}

export function createGitHubOAuthSessionValidator(): ValidationHook {
  return async (actorId: string, authToken?: string) => {
    if (!authToken) {
      throw new AuthError("AUTH_MISSING", "authorization required");
    }

    const session = await resolveGithubOAuthSession(authToken);
    if (!session) {
      throw new AuthError("AUTH_TOKEN_NOT_FOUND", "not authorized");
    }

    if (session.actorId !== actorId) {
      throw new AuthError("AUTH_ACTOR_MISMATCH", "not authorized");
    }
  };
}

export function createTokenAuthValidator(tokenStore: ActorTokenStore): ValidationHook {
  return async (_actorId: string, authToken?: string) => {
    await resolveActorIdFromToken(tokenStore, authToken);
  };
}

export function createEnvAuthValidator(tokenStore: ActorTokenStore): ValidationHook {
  return createTokenAuthValidator(tokenStore);
}

export async function resolveActorIdFromToken(tokenStore: ActorTokenStore, authToken?: string): Promise<string> {
  if (!authToken) {
    throw new AuthError("AUTH_MISSING", "authorization required");
  }

  const record = await tokenStore.resolveToken(authToken);
  if (!record) {
    throw new AuthError("AUTH_TOKEN_NOT_FOUND", "token not recognized");
  }
  if (record.revokedAt) {
    throw new AuthError("AUTH_TOKEN_REVOKED", "token revoked");
  }
  await tokenStore.touchToken(record.tokenHash);
  return record.actorId;
}
