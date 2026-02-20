import postgres, { Sql } from "postgres";

export interface PendingGithubOAuthState {
  actorIdHint?: string;
  expiresAt: number;
}

export interface ActiveGithubOAuthSession {
  actorId: string;
  accessToken: string;
  expiresAt: number;
}

const pendingStates = new Map<string, PendingGithubOAuthState>();
const activeSessions = new Map<string, ActiveGithubOAuthSession>();

let sqlClient: Sql | undefined;

function isStrictPersistenceRequired(): boolean {
  return process.env.R2R_OAUTH_STRICT_PERSISTENCE === "true" || process.env.NODE_ENV === "production";
}

function getClient(): Sql | undefined {
  const databaseUrl = process.env.R2R_DATABASE_URL;
  if (!databaseUrl) {
    if (isStrictPersistenceRequired()) {
      throw new Error("R2R_DATABASE_URL is required for OAuth session persistence");
    }
    return undefined;
  }

  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, { prepare: false });
  }
  return sqlClient;
}

function randomToken(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export async function gcGithubOAuthSessionStore(now = Date.now()): Promise<void> {
  const client = getClient();
  if (client) {
    const nowDate = new Date(now);
    await client`delete from hub_oauth_pending_states where expires_at <= ${nowDate}`;
    await client`delete from hub_oauth_sessions where expires_at <= ${nowDate}`;
    return;
  }

  for (const [state, entry] of pendingStates.entries()) {
    if (entry.expiresAt <= now) {
      pendingStates.delete(state);
    }
  }

  for (const [token, entry] of activeSessions.entries()) {
    if (entry.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
}

export async function issueGithubOAuthState(input: { actorIdHint?: string; ttlMs?: number } = {}): Promise<string> {
  await gcGithubOAuthSessionStore();
  const state = randomToken("state");
  const expiresAt = Date.now() + (input.ttlMs ?? 10 * 60 * 1000);
  const client = getClient();
  if (client) {
    await client`
      insert into hub_oauth_pending_states (state, actor_id_hint, expires_at)
      values (${state}, ${input.actorIdHint ?? null}, ${new Date(expiresAt)})
    `;
    return state;
  }

  pendingStates.set(state, {
    actorIdHint: input.actorIdHint,
    expiresAt
  });
  return state;
}

export async function consumeGithubOAuthState(state: string): Promise<PendingGithubOAuthState> {
  await gcGithubOAuthSessionStore();
  const client = getClient();
  if (client) {
    const rows = await client<{
      actor_id_hint: string | null;
      expires_at: Date;
    }[]>`select actor_id_hint, expires_at from hub_oauth_pending_states where state = ${state} limit 1`;
    const pending = rows[0];
    if (!pending) {
      throw new Error("OAuth state is invalid or expired");
    }
    await client`delete from hub_oauth_pending_states where state = ${state}`;
    return {
      actorIdHint: pending.actor_id_hint ?? undefined,
      expiresAt: pending.expires_at.getTime()
    };
  }

  const pending = pendingStates.get(state);
  if (!pending) {
    throw new Error("OAuth state is invalid or expired");
  }

  pendingStates.delete(state);
  return pending;
}

export async function issueGithubOAuthSession(input: {
  actorId: string;
  accessToken: string;
  ttlMs?: number;
}): Promise<string> {
  await gcGithubOAuthSessionStore();
  const sessionToken = randomToken("r2r_session");
  const expiresAt = Date.now() + (input.ttlMs ?? 24 * 60 * 60 * 1000);
  const client = getClient();
  if (client) {
    await client`
      insert into hub_oauth_sessions (session_token, actor_id, access_token, expires_at)
      values (${sessionToken}, ${input.actorId}, ${input.accessToken}, ${new Date(expiresAt)})
    `;
    return sessionToken;
  }

  activeSessions.set(sessionToken, {
    actorId: input.actorId,
    accessToken: input.accessToken,
    expiresAt
  });
  return sessionToken;
}

export async function resolveGithubOAuthSession(sessionToken: string): Promise<ActiveGithubOAuthSession | undefined> {
  await gcGithubOAuthSessionStore();
  const client = getClient();
  if (client) {
    const rows = await client<{
      actor_id: string;
      access_token: string;
      expires_at: Date;
    }[]>`select actor_id, access_token, expires_at from hub_oauth_sessions where session_token = ${sessionToken} limit 1`;
    const session = rows[0];
    if (!session) {
      return undefined;
    }
    return {
      actorId: session.actor_id,
      accessToken: session.access_token,
      expiresAt: session.expires_at.getTime()
    };
  }

  return activeSessions.get(sessionToken);
}
