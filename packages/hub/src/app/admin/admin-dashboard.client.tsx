"use client";

import { useEffect, useMemo, useState } from "react";

type CommunityReport = {
  id: string;
  runId: string;
  reason: string;
  details?: string;
  createdAt: string;
  status: "open" | "resolved";
  resolvedAt?: string;
  resolverActorId?: string;
};

type AdminActionLog = {
  id: string;
  actorId: string;
  action: string;
  reportId?: string;
  runId?: string;
  queueReverification: boolean;
  createdAt: string;
};

type AdminApiResponse = {
  ok: boolean;
  status: number;
  data?: CommunityReport[];
  meta?: {
    total: number;
    limit: number;
    offset: number;
    sortBy: "createdAt" | "status";
    sortOrder: "asc" | "desc";
    csrfToken: string;
    logsByReport: Record<string, AdminActionLog[]>;
  };
  error?: {
    message?: string;
  };
};

type ResolveApiResponse = {
  ok: boolean;
  status: number;
  error?: {
    message?: string;
  };
};

type SubmissionEvidence = {
  runId: string;
  model: string;
  score: number;
  dimensionScores: Record<string, number>;
  evidenceChain?: {
    timeline: Array<{ phase: string; startedAt: string; completedAt: string; model: string }>;
    samples: Array<{ roundIndex: number; requirement: string; codeSubmission: string }>;
  };
};

type EvidenceApiResponse = {
  ok: boolean;
  status: number;
  data?: SubmissionEvidence;
  error?: { message?: string };
};

export function AdminDashboardClient() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [sortBy, setSortBy] = useState<"createdAt" | "status">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const [csrfToken, setCsrfToken] = useState("");
  const [logsByReport, setLogsByReport] = useState<Record<string, AdminActionLog[]>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<SubmissionEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const isEn = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const url = new URL(window.location.href);
    return url.searchParams.get("lang") === "en";
  }, []);

  async function loadReports(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (query.trim()) {
        params.set("q", query.trim());
      }

      const response = await fetch(`/api/admin/reports?${params.toString()}`, { credentials: "include" });
      const payload = (await response.json()) as AdminApiResponse;
      if (!payload.ok || !payload.data) {
        const message = payload.error?.message ?? (isEn ? "Failed to load admin reports" : "加载管理举报失败");
        setError(message);
        if (message.includes("admin session required") || message.includes("forbidden")) {
          void loadGithubLoginUrl();
        }
        setReports([]);
        setTotal(0);
        setCsrfToken("");
        setLogsByReport({});
        return;
      }
      setReports(payload.data);
      setTotal(payload.meta?.total ?? payload.data.length);
      setCsrfToken(payload.meta?.csrfToken ?? "");
      setLogsByReport(payload.meta?.logsByReport ?? {});
      setSelectedIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setReports([]);
      setTotal(0);
      setCsrfToken("");
      setLogsByReport({});
    } finally {
      setLoading(false);
    }
  }

  async function loadGithubLoginUrl(): Promise<void> {
    try {
      const response = await fetch("/api/auth/github?action=login", { credentials: "include" });
      const payload = (await response.json()) as { ok?: boolean; data?: { authUrl?: string } };
      if (payload.ok && payload.data?.authUrl) {
        setAuthUrl(payload.data.authUrl);
      }
    } catch {
      setAuthUrl(null);
    }
  }

  useEffect(() => {
    void loadReports();
  }, [statusFilter, query, offset, sortBy, sortOrder]);

  async function resolveReport(id: string, queueReverification: boolean): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/reports/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({ id, queueReverification })
      });
      const payload = (await response.json()) as ResolveApiResponse;
      if (!payload.ok) {
        setError(payload.error?.message ?? (isEn ? "Failed to process report" : "处理举报失败"));
        return;
      }

      await loadReports();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : String(resolveError));
    } finally {
      setBusyId(null);
    }
  }

  async function batchResolve(queueReverification: boolean): Promise<void> {
    if (selectedIds.length === 0) {
      return;
    }

    setBusyId("batch");
    setError(null);
    try {
      const response = await fetch("/api/admin/reports/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken
        },
        credentials: "include",
        body: JSON.stringify({ ids: selectedIds, queueReverification })
      });
      const payload = (await response.json()) as ResolveApiResponse;
      if (!payload.ok) {
        setError(payload.error?.message ?? (isEn ? "Batch operation failed" : "批量操作失败"));
        return;
      }

      await loadReports();
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : String(batchError));
    } finally {
      setBusyId(null);
    }
  }

  async function openEvidence(runId: string): Promise<void> {
    setEvidenceLoading(true);
    setSelectedEvidence(null);
    try {
      const response = await fetch(`/api/admin/reports/evidence?runId=${encodeURIComponent(runId)}`, {
        credentials: "include"
      });
      const payload = (await response.json()) as EvidenceApiResponse;
      if (!payload.ok || !payload.data) {
        setError(payload.error?.message ?? (isEn ? "Failed to load evidence" : "加载证据失败"));
        return;
      }
      setSelectedEvidence(payload.data);
    } catch (evidenceError) {
      setError(evidenceError instanceof Error ? evidenceError.message : String(evidenceError));
    } finally {
      setEvidenceLoading(false);
    }
  }

  function toggleSelect(reportId: string): void {
    setSelectedIds((prev) => (prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId]));
  }

  return (
    <section>
      <h1>{isEn ? "Admin Dashboard" : "管理后台"}</h1>
      <p className="hub-muted">
        {isEn ? "Community reports and moderation actions (GitHub admin only)." : "社区举报与审核操作（仅 GitHub 管理员可用）。"}
      </p>
      {error ? <p className="hub-muted">{error}</p> : null}
      {error && authUrl ? (
        <p>
          <a href={authUrl}>{isEn ? "Login with GitHub" : "使用 GitHub 登录"}</a>
          <span className="hub-muted"> {isEn ? "(admin: QingJ01)" : "（管理员账号：QingJ01）"}</span>
        </p>
      ) : null}
      {loading ? <p className="hub-muted">{isEn ? "Loading..." : "加载中..."}</p> : null}

      <div className="hub-card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            <span className="hub-muted" style={{ marginRight: 6 }}>{isEn ? "Status" : "状态"}</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setOffset(0);
                setStatusFilter(event.target.value as "all" | "open" | "resolved");
              }}
            >
              <option value="all">{isEn ? "All" : "全部"}</option>
              <option value="open">{isEn ? "Open" : "待处理"}</option>
              <option value="resolved">{isEn ? "Resolved" : "已处理"}</option>
            </select>
          </label>
          <label>
            <span className="hub-muted" style={{ marginRight: 6 }}>{isEn ? "Sort" : "排序"}</span>
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(event) => {
                setOffset(0);
                const [nextSortBy, nextSortOrder] = event.target.value.split(":");
                setSortBy(nextSortBy === "status" ? "status" : "createdAt");
                setSortOrder(nextSortOrder === "asc" ? "asc" : "desc");
              }}
            >
              <option value="createdAt:desc">{isEn ? "Newest first" : "最新优先"}</option>
              <option value="createdAt:asc">{isEn ? "Oldest first" : "最早优先"}</option>
              <option value="status:asc">{isEn ? "Status A-Z" : "状态升序"}</option>
              <option value="status:desc">{isEn ? "Status Z-A" : "状态降序"}</option>
            </select>
          </label>
          <label>
            <span className="hub-muted" style={{ marginRight: 6 }}>{isEn ? "Search" : "搜索"}</span>
            <input
              value={query}
              onChange={(event) => {
                setOffset(0);
                setQuery(event.target.value);
              }}
              placeholder={isEn ? "runId/reason/details" : "runId/原因/详情"}
            />
          </label>
          <span className="hub-muted">{isEn ? `Total ${total}` : `共 ${total} 条`}</span>
        </div>
      </div>

      <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="hub-viz-button" disabled={selectedIds.length === 0 || busyId !== null} onClick={() => batchResolve(false)}>
          {isEn ? `Resolve Selected (${selectedIds.length})` : `批量仅处理（${selectedIds.length}）`}
        </button>
        <button className="hub-viz-button" disabled={selectedIds.length === 0 || busyId !== null} onClick={() => batchResolve(true)}>
          {isEn ? `Resolve + Reverify Selected (${selectedIds.length})` : `批量处理并复验（${selectedIds.length}）`}
        </button>
      </div>

      <table className="hub-table hub-card">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={reports.length > 0 && selectedIds.length === reports.length}
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelectedIds(reports.map((report) => report.id));
                  } else {
                    setSelectedIds([]);
                  }
                }}
              />
            </th>
            <th>ID</th>
            <th>{isEn ? "Run" : "运行"}</th>
            <th>{isEn ? "Reason" : "原因"}</th>
            <th>{isEn ? "Status" : "状态"}</th>
            <th>{isEn ? "Created" : "创建时间"}</th>
            <th>{isEn ? "Action" : "操作"}</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan={7} className="hub-muted">
                {isEn ? "No reports" : "暂无举报"}
              </td>
            </tr>
          ) : (
            reports.map((report) => (
              <tr key={report.id}>
                <td>
                  <input type="checkbox" checked={selectedIds.includes(report.id)} onChange={() => toggleSelect(report.id)} />
                </td>
                <td>{report.id}</td>
                <td>{report.runId}</td>
                <td>{report.reason}</td>
                <td>{report.status}</td>
                <td>{new Date(report.createdAt).toLocaleString()}</td>
                <td>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div>
                      <button className="hub-viz-button" disabled={evidenceLoading} onClick={() => openEvidence(report.runId)}>
                        {isEn ? "Evidence" : "证据详情"}
                      </button>
                    </div>
                    {report.status === "resolved" ? (
                      <span className="hub-muted">{isEn ? "Resolved" : "已处理"}</span>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="hub-viz-button" disabled={busyId === report.id} onClick={() => resolveReport(report.id, false)}>
                          {isEn ? "Resolve" : "仅处理"}
                        </button>
                        <button className="hub-viz-button" disabled={busyId === report.id} onClick={() => resolveReport(report.id, true)}>
                          {isEn ? "Resolve + Reverify" : "处理并复验"}
                        </button>
                      </div>
                    )}
                    <div className="hub-muted" style={{ fontSize: 12 }}>
                      {(logsByReport[report.id] ?? []).slice(0, 2).map((log) => (
                        <div key={log.id}>{new Date(log.createdAt).toLocaleString()} · {log.actorId}</div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {selectedEvidence ? (
        <section className="hub-card" style={{ padding: 12, marginTop: 12 }}>
          <h3>{isEn ? "Evidence Detail" : "证据详情"}</h3>
          <p className="hub-muted">{selectedEvidence.runId} · {selectedEvidence.model} · {selectedEvidence.score.toFixed(1)}</p>
          <div>
            <strong>{isEn ? "Timeline" : "时间线"}</strong>
            <ul>
              {(selectedEvidence.evidenceChain?.timeline ?? []).map((item, index) => (
                <li key={`${item.phase}-${index}`}>
                  {item.phase} · {new Date(item.startedAt).toLocaleTimeString()} - {new Date(item.completedAt).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <strong>{isEn ? "Samples" : "样本"}</strong>
            <ul>
              {(selectedEvidence.evidenceChain?.samples ?? []).slice(0, 2).map((sample) => (
                <li key={sample.roundIndex}>#{sample.roundIndex} · {sample.requirement.slice(0, 80)}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button className="hub-viz-button" disabled={offset <= 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - limit))}>
          {isEn ? "Prev" : "上一页"}
        </button>
        <button className="hub-viz-button" disabled={offset + limit >= total || loading} onClick={() => setOffset((value) => value + limit)}>
          {isEn ? "Next" : "下一页"}
        </button>
      </div>
    </section>
  );
}
