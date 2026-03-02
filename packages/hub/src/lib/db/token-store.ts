import postgres from "postgres";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { actorTokensTable } from "./schema";
import { ActorTokenRecord, ActorTokenStore, IssueTokenResult, hashToken } from "../token-store";
import { randomBytes } from "node:crypto";

function generateToken(): string {
  return `r2r_session_${randomBytes(24).toString("hex")}`;
}

function toRecord(row: {
  tokenHash: string;
  actorId: string;
  label: string | null;
  issuedAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}): ActorTokenRecord {
  return {
    tokenHash: row.tokenHash,
    actorId: row.actorId,
    label: row.label ?? undefined,
    issuedAt: row.issuedAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString(),
    revokedAt: row.revokedAt?.toISOString()
  };
}

export function createDrizzleTokenStore(databaseUrl: string): ActorTokenStore {
  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client);

  return {
    async issueToken(actorId: string, label?: string): Promise<IssueTokenResult> {
      const token = generateToken();
      const tokenHash = hashToken(token);
      const issuedAt = new Date();
      await db
        .update(actorTokensTable)
        .set({ revokedAt: new Date() })
        .where(and(eq(actorTokensTable.actorId, actorId), isNull(actorTokensTable.revokedAt)));
      await db
        .insert(actorTokensTable)
        .values({ tokenHash, actorId, label: label ?? null, issuedAt })
        .onConflictDoNothing();
      return { token, actorId, issuedAt: issuedAt.toISOString() };
    },
    async resolveToken(token: string): Promise<ActorTokenRecord | undefined> {
      const tokenHash = hashToken(token);
      const rows = await db
        .select()
        .from(actorTokensTable)
        .where(eq(actorTokensTable.tokenHash, tokenHash))
        .limit(1);
      const record = rows[0];
      if (!record) {
        return undefined;
      }
      return toRecord(record);
    },
    async touchToken(tokenHash: string): Promise<void> {
      await db
        .update(actorTokensTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(actorTokensTable.tokenHash, tokenHash));
    },
    async revokeToken(tokenHash: string): Promise<void> {
      await db
        .update(actorTokensTable)
        .set({ revokedAt: new Date() })
        .where(and(eq(actorTokensTable.tokenHash, tokenHash), isNull(actorTokensTable.revokedAt)));
    },
    async listTokens(actorId: string): Promise<ActorTokenRecord[]> {
      const rows = await db.select().from(actorTokensTable).where(eq(actorTokensTable.actorId, actorId));
      return rows.map(toRecord);
    }
  };
}
