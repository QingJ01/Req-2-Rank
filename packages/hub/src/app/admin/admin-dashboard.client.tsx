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

type AdminApiResponse = {
  ok: boolean;
  status: number;
  data?: CommunityReport[];
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

export function AdminDashboardClient() {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

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
      const response = await fetch("/api/admin/reports", { credentials: "include" });
      const payload = (await response.json()) as AdminApiResponse;
      if (!payload.ok || !payload.data) {
        const message = payload.error?.message ?? (isEn ? "Failed to load admin reports" : "加载管理举报失败");
        setError(message);
        if (message.includes("admin session required") || message.includes("forbidden")) {
          void loadGithubLoginUrl();
        }
        setReports([]);
        return;
      }
      setReports(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setReports([]);
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
  }, []);

  async function resolveReport(id: string, queueReverification: boolean): Promise<void> {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/reports/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
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

      <table className="hub-table hub-card">
        <thead>
          <tr>
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
              <td colSpan={6} className="hub-muted">
                {isEn ? "No reports" : "暂无举报"}
              </td>
            </tr>
          ) : (
            reports.map((report) => (
              <tr key={report.id}>
                <td>{report.id}</td>
                <td>{report.runId}</td>
                <td>{report.reason}</td>
                <td>{report.status}</td>
                <td>{new Date(report.createdAt).toLocaleString()}</td>
                <td>
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
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
