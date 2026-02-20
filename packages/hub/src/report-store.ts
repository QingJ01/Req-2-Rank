import postgres, { Sql } from "postgres";

export interface CommunityReport {
  id: string;
  runId: string;
  reason: string;
  details?: string;
  createdAt: string;
  status: "open" | "resolved";
  resolvedAt?: string;
  resolverActorId?: string;
}

const reports: CommunityReport[] = [];
let sqlClient: Sql | undefined;
let schemaReady = false;

function getClient(): Sql | undefined {
  const databaseUrl = process.env.R2R_DATABASE_URL;
  if (!databaseUrl) {
    return undefined;
  }
  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, { prepare: false });
  }
  return sqlClient;
}

async function ensureSchema(client: Sql): Promise<void> {
  if (schemaReady) {
    return;
  }
  await client`
    create table if not exists hub_community_reports (
      id text primary key,
      run_id text not null,
      reason text not null,
      details text,
      status text not null default 'open',
      resolver_actor_id text,
      resolved_at timestamp with time zone,
      created_at timestamp with time zone not null default now()
    )
  `;
  schemaReady = true;
}

function fromRow(row: {
  id: string;
  run_id: string;
  reason: string;
  details: string | null;
  status: string;
  resolver_actor_id: string | null;
  resolved_at: Date | null;
  created_at: Date;
}): CommunityReport {
  return {
    id: row.id,
    runId: row.run_id,
    reason: row.reason,
    details: row.details ?? undefined,
    status: row.status === "resolved" ? "resolved" : "open",
    resolverActorId: row.resolver_actor_id ?? undefined,
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : undefined,
    createdAt: row.created_at.toISOString()
  };
}

export async function submitCommunityReport(input: { runId: string; reason: string; details?: string }): Promise<CommunityReport> {
  const report: CommunityReport = {
    id: `report-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    runId: input.runId,
    reason: input.reason,
    details: input.details,
    createdAt: new Date().toISOString(),
    status: "open"
  };

  const client = getClient();
  if (!client) {
    reports.unshift(report);
    return report;
  }

  await ensureSchema(client);
  const rows = await client<{
    id: string;
    run_id: string;
    reason: string;
    details: string | null;
    status: string;
    resolver_actor_id: string | null;
    resolved_at: Date | null;
    created_at: Date;
  }[]>`
    insert into hub_community_reports (id, run_id, reason, details, status)
    values (${report.id}, ${report.runId}, ${report.reason}, ${report.details ?? null}, 'open')
    returning id, run_id, reason, details, status, resolver_actor_id, resolved_at, created_at
  `;

  return fromRow(rows[0]);
}

export async function listCommunityReports(): Promise<CommunityReport[]> {
  const client = getClient();
  if (!client) {
    return reports.slice();
  }

  await ensureSchema(client);
  const rows = await client<{
    id: string;
    run_id: string;
    reason: string;
    details: string | null;
    status: string;
    resolver_actor_id: string | null;
    resolved_at: Date | null;
    created_at: Date;
  }[]>`
    select id, run_id, reason, details, status, resolver_actor_id, resolved_at, created_at
    from hub_community_reports
    order by created_at desc
  `;

  return rows.map(fromRow);
}

export async function getCommunityReport(id: string): Promise<CommunityReport | undefined> {
  const client = getClient();
  if (!client) {
    return reports.find((item) => item.id === id);
  }

  await ensureSchema(client);
  const rows = await client<{
    id: string;
    run_id: string;
    reason: string;
    details: string | null;
    status: string;
    resolver_actor_id: string | null;
    resolved_at: Date | null;
    created_at: Date;
  }[]>`
    select id, run_id, reason, details, status, resolver_actor_id, resolved_at, created_at
    from hub_community_reports
    where id = ${id}
    limit 1
  `;

  return rows[0] ? fromRow(rows[0]) : undefined;
}

export async function resolveCommunityReport(id: string, resolverActorId?: string): Promise<CommunityReport | undefined> {
  const client = getClient();
  if (!client) {
    const report = reports.find((item) => item.id === id);
    if (!report) {
      return undefined;
    }
    report.status = "resolved";
    report.resolvedAt = new Date().toISOString();
    report.resolverActorId = resolverActorId;
    return report;
  }

  await ensureSchema(client);
  const rows = await client<{
    id: string;
    run_id: string;
    reason: string;
    details: string | null;
    status: string;
    resolver_actor_id: string | null;
    resolved_at: Date | null;
    created_at: Date;
  }[]>`
    update hub_community_reports
    set status = 'resolved', resolver_actor_id = ${resolverActorId ?? null}, resolved_at = now()
    where id = ${id}
    returning id, run_id, reason, details, status, resolver_actor_id, resolved_at, created_at
  `;

  return rows[0] ? fromRow(rows[0]) : undefined;
}
