import { ValidationHook, createAuthValidator } from "../routes.js";
import { resolveGithubOAuthSession } from "./github-oauth-session.js";

export interface HeaderMap {
  authorization?: string;
}

export function parseBearerToken(headers: HeaderMap): string | undefined {
  const value = headers.authorization;
  if (!value) {
    return undefined;
  }

  const [scheme, token] = value.split(" ");
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
      throw new Error("not authorized");
    }

    const response = await fetchImpl("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "User-Agent": "req2rank-hub"
      }
    });

    if (!response.ok) {
      throw new Error("not authorized");
    }

    const user = (await response.json()) as GitHubUserResponse;
    if (!user.login) {
      throw new Error("not authorized");
    }

    if (actorId !== user.login && actorId !== String(user.id)) {
      throw new Error("not authorized");
    }
  };
}

export function createGitHubOAuthSessionValidator(): ValidationHook {
  return async (actorId: string, authToken?: string) => {
    if (!authToken) {
      throw new Error("not authorized");
    }

    const session = resolveGithubOAuthSession(authToken);
    if (!session) {
      throw new Error("not authorized");
    }

    if (session.actorId !== actorId) {
      throw new Error("not authorized");
    }
  };
}

export function createEnvAuthValidator(): ValidationHook {
  if (process.env.R2R_GITHUB_OAUTH === "true") {
    return createGitHubOAuthSessionValidator();
  }

  const expectedToken = process.env.R2R_HUB_TOKEN ?? "dev-token";
  return createAuthValidator(expectedToken);
}
