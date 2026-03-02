import { createHash, randomBytes } from "node:crypto";

export interface ActorTokenRecord {
  tokenHash: string;
  actorId: string;
  issuedAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  label?: string;
}

export interface IssueTokenResult {
  token: string;
  actorId: string;
  issuedAt: string;
}

export interface ActorTokenStore {
  issueToken(actorId: string, label?: string): Promise<IssueTokenResult>;
  resolveToken(token: string): Promise<ActorTokenRecord | undefined>;
  touchToken(tokenHash: string): Promise<void>;
  revokeToken(tokenHash: string): Promise<void>;
  listTokens(actorId: string): Promise<ActorTokenRecord[]>;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return `r2r_session_${randomBytes(24).toString("hex")}`;
}

export function createMemoryTokenStore(): ActorTokenStore {
  const records = new Map<string, ActorTokenRecord>();

  return {
    async issueToken(actorId: string, label?: string): Promise<IssueTokenResult> {
      const revokeAt = new Date().toISOString();
      for (const record of records.values()) {
        if (record.actorId === actorId && !record.revokedAt) {
          record.revokedAt = revokeAt;
        }
      }
      const token = generateToken();
      const tokenHash = hashToken(token);
      const issuedAt = new Date().toISOString();
      records.set(tokenHash, { tokenHash, actorId, issuedAt, label });
      return { token, actorId, issuedAt };
    },
    async resolveToken(token: string): Promise<ActorTokenRecord | undefined> {
      const tokenHash = hashToken(token);
      return records.get(tokenHash);
    },
    async touchToken(tokenHash: string): Promise<void> {
      const record = records.get(tokenHash);
      if (!record) {
        return;
      }
      record.lastUsedAt = new Date().toISOString();
      records.set(tokenHash, record);
    },
    async revokeToken(tokenHash: string): Promise<void> {
      const record = records.get(tokenHash);
      if (!record) {
        return;
      }
      record.revokedAt = new Date().toISOString();
      records.set(tokenHash, record);
    },
    async listTokens(actorId: string): Promise<ActorTokenRecord[]> {
      return Array.from(records.values()).filter((record) => record.actorId === actorId);
    }
  };
}
