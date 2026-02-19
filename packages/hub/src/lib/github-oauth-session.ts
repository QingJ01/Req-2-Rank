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

function randomToken(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function gcGithubOAuthSessionStore(now = Date.now()): void {
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

export function issueGithubOAuthState(input: { actorIdHint?: string; ttlMs?: number } = {}): string {
  gcGithubOAuthSessionStore();
  const state = randomToken("state");
  pendingStates.set(state, {
    actorIdHint: input.actorIdHint,
    expiresAt: Date.now() + (input.ttlMs ?? 10 * 60 * 1000)
  });
  return state;
}

export function consumeGithubOAuthState(state: string): PendingGithubOAuthState {
  gcGithubOAuthSessionStore();
  const pending = pendingStates.get(state);
  if (!pending) {
    throw new Error("OAuth state is invalid or expired");
  }

  pendingStates.delete(state);
  return pending;
}

export function issueGithubOAuthSession(input: {
  actorId: string;
  accessToken: string;
  ttlMs?: number;
}): string {
  gcGithubOAuthSessionStore();
  const sessionToken = randomToken("r2r_session");
  activeSessions.set(sessionToken, {
    actorId: input.actorId,
    accessToken: input.accessToken,
    expiresAt: Date.now() + (input.ttlMs ?? 24 * 60 * 60 * 1000)
  });
  return sessionToken;
}

export function resolveGithubOAuthSession(sessionToken: string): ActiveGithubOAuthSession | undefined {
  gcGithubOAuthSessionStore();
  return activeSessions.get(sessionToken);
}
