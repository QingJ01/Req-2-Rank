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

export interface CommunityReportQuery {
  status?: "all" | "open" | "resolved";
  q?: string;
  sortBy?: "createdAt" | "status";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface CommunityReportQueryResult {
  items: CommunityReport[];
  total: number;
}

export interface AdminActionLog {
  id: string;
  actorId: string;
  action: string;
  reportId?: string;
  runId?: string;
  queueReverification: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const reports: CommunityReport[] = [];
const actionLogs: AdminActionLog[] = [];
let sqlClient: Sql | undefined;

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

function fromReportRow(row: {
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

function fromActionRow(row: {
  id: number;
  actor_id: string;
  action: string;
  report_id: string | null;
  run_id: string | null;
  queue_reverification: boolean;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}): AdminActionLog {
  return {
    id: String(row.id),
    actorId: row.actor_id,
    action: row.action,
    reportId: row.report_id ?? undefined,
    runId: row.run_id ?? undefined,
    queueReverification: row.queue_reverification,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString()
  };
}

function applyQuery(items: CommunityReport[], query: CommunityReportQuery): CommunityReportQueryResult {
  const status = query.status ?? "all";
  const sortBy = query.sortBy ?? "createdAt";
  const sortOrder = query.sortOrder ?? "desc";
  const offset = Math.max(0, query.offset ?? 0);
  const limit = Math.max(1, Math.min(query.limit ?? 20, 100));
  const needle = (query.q ?? "").trim().toLowerCase();

  let filtered = items.slice();
  if (status === "open" || status === "resolved") {
    filtered = filtered.filter((item) => item.status === status);
  }
  if (needle) {
    filtered = filtered.filter((item) => `${item.runId} ${item.reason} ${item.details ?? ""}`.toLowerCase().includes(needle));
  }

  filtered.sort((left, right) => {
    if (sortBy === "status") {
      const l = left.status;
      const r = right.status;
      if (l === r) {
        const delta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
        return sortOrder === "asc" ? delta : -delta;
      }
      return sortOrder === "asc" ? l.localeCompare(r) : r.localeCompare(l);
    }
    const delta = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return sortOrder === "asc" ? delta : -delta;
  });

  return {
    total: filtered.length,
    items: filtered.slice(offset, offset + limit)
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

  return fromReportRow(rows[0]);
}

export async function listCommunityReports(query: CommunityReportQuery = {}): Promise<CommunityReportQueryResult> {
  const client = getClient();
  if (!client) {
    return applyQuery(reports, query);
  }

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
  `;

  return applyQuery(rows.map(fromReportRow), query);
}

export async function getCommunityReport(id: string): Promise<CommunityReport | undefined> {
  const client = getClient();
  if (!client) {
    return reports.find((item) => item.id === id);
  }

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

  return rows[0] ? fromReportRow(rows[0]) : undefined;
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

  return rows[0] ? fromReportRow(rows[0]) : undefined;
}

export async function logAdminAction(input: {
  actorId: string;
  action: string;
  reportId?: string;
  runId?: string;
  queueReverification?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<AdminActionLog> {
  const record: AdminActionLog = {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    actorId: input.actorId,
    action: input.action,
    reportId: input.reportId,
    runId: input.runId,
    queueReverification: input.queueReverification ?? false,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString()
  };

  const client = getClient();
  if (!client) {
    actionLogs.unshift(record);
    return record;
  }

  const rows = (await client`
    insert into hub_admin_action_logs (actor_id, action, report_id, run_id, queue_reverification, metadata)
    values (
      ${input.actorId},
      ${input.action},
      ${input.reportId ?? null},
      ${input.runId ?? null},
      ${input.queueReverification ?? false},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
    returning id, actor_id, action, report_id, run_id, queue_reverification, metadata, created_at
  `) as Array<{
    id: number;
    actor_id: string;
    action: string;
    report_id: string | null;
    run_id: string | null;
    queue_reverification: boolean;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  }>;

  return fromActionRow(rows[0]);
}

export async function listAdminActionLogs(options: { reportId?: string; limit?: number } = {}): Promise<AdminActionLog[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  const client = getClient();
  if (!client) {
    const filtered = options.reportId ? actionLogs.filter((item) => item.reportId === options.reportId) : actionLogs;
    return filtered.slice(0, limit);
  }

  const rows = (options.reportId
    ? await client`
        select id, actor_id, action, report_id, run_id, queue_reverification, metadata, created_at
        from hub_admin_action_logs
        where report_id = ${options.reportId}
        order by created_at desc
        limit ${limit}
      `
    : await client`
        select id, actor_id, action, report_id, run_id, queue_reverification, metadata, created_at
        from hub_admin_action_logs
        order by created_at desc
        limit ${limit}
      `) as Array<{
    id: number;
    actor_id: string;
    action: string;
    report_id: string | null;
    run_id: string | null;
    queue_reverification: boolean;
    metadata: Record<string, unknown> | null;
    created_at: Date;
  }>;

  return rows.map(fromActionRow);
}
