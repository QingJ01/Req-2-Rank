import { afterEach, describe, expect, it } from "vitest";
import { issueGithubOAuthState } from "./github-oauth-session.js";

describe("github oauth session persistence", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDatabaseUrl = process.env.R2R_DATABASE_URL;
  const originalStrict = process.env.R2R_OAUTH_STRICT_PERSISTENCE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.R2R_DATABASE_URL = originalDatabaseUrl;
    process.env.R2R_OAUTH_STRICT_PERSISTENCE = originalStrict;
  });

  it("throws when strict persistence is enabled without database url", async () => {
    delete process.env.R2R_DATABASE_URL;
    process.env.R2R_OAUTH_STRICT_PERSISTENCE = "true";

    await expect(issueGithubOAuthState({ actorIdHint: "user-1" })).rejects.toThrow(
      "R2R_DATABASE_URL is required for OAuth session persistence"
    );
  });
});
