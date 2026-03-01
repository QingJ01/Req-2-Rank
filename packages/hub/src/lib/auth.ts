import { AuthError, ValidationHook, createAuthValidator } from "../routes";
import { resolveGithubOAuthSession } from "./github-oauth-session";

export interface HeaderMap {
  authorization?: string;
}

export function parseBearerToken(headers: HeaderMap): string | undefined {
  const value = headers.authorization;
  if (!value) {
    return undefined;
  }

  const [scheme, token] = value.trim().split(/\s+/, 2);
  if (!scheme || !token) {
    return undefined;
  }

  if (scheme.toLowerCase() !== "bearer") {
    return undefined;
  }

  return token;
}

interface GitHubUserResponse {
  id: number;
  login: string;
}

export function createGitHubAuthValidator(fetchImpl: typeof fetch = fetch): ValidationHook {
  return async (actorId: string, authToken?: string) => {
    if (!authToken) {
      throw new AuthError("not authorized");
    }

    const response = await fetchImpl("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "User-Agent": "req2rank-hub"
      }
    });

    if (!response.ok) {
      throw new AuthError("not authorized");
    }

    const user = (await response.json()) as GitHubUserResponse;
    if (!user.login) {
      throw new AuthError("not authorized");
    }

    if (actorId !== user.login && actorId !== String(user.id)) {
      throw new AuthError("not authorized");
    }
  };
}

export function createGitHubOAuthSessionValidator(): ValidationHook {
  return async (actorId: string, authToken?: string) => {
    if (!authToken) {
      throw new AuthError("not authorized");
    }

    const session = await resolveGithubOAuthSession(authToken);
    if (!session) {
      throw new AuthError("not authorized");
    }

    if (session.actorId !== actorId) {
      throw new AuthError("not authorized");
    }
  };
}

export function createEnvAuthValidator(): ValidationHook {
  if (process.env.R2R_GITHUB_OAUTH === "true") {
    return createGitHubOAuthSessionValidator();
  }

  const expectedToken = process.env.R2R_HUB_TOKEN;
  if (!expectedToken) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("R2R_HUB_TOKEN is required when OAuth is disabled in production");
    }
    return createAuthValidator("dev-token");
  }

  return createAuthValidator(expectedToken);
}
