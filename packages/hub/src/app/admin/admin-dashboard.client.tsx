"use client";

import { useEffect, useState } from "react";
import { HUB_LANG_EVENT, pickLang, type Lang } from "../i18n";
import { t } from "../locales";

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
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const [csrfToken, setCsrfToken] = useState("");
  const [logsByReport, setLogsByReport] = useState<Record<string, AdminActionLog[]>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<SubmissionEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const syncLang = () => {
      setLang(pickLang(window.localStorage.getItem("hub.lang")));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "hub.lang") {
        syncLang();
      }
    };

    syncLang();
    window.addEventListener("storage", onStorage);
    window.addEventListener(HUB_LANG_EVENT, syncLang);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HUB_LANG_EVENT, syncLang);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryInput);
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [queryInput]);

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
        const message = payload.error?.message ?? t(lang, "loadFailed");
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
      const response = await fetch("/api/auth/github?action=login&format=json&redirect=%2Fadmin", { credentials: "include" });
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
        setError(payload.error?.message ?? t(lang, "processFailed"));
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
        setError(payload.error?.message ?? t(lang, "batchFailed"));
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
        setError(payload.error?.message ?? t(lang, "evidenceFailed"));
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
      <h1>{t(lang, "adminDashboard")}</h1>
      <p className="hub-muted">{t(lang, "adminDesc")}</p>
      {error ? <p className="hub-muted">{error}</p> : null}
      {error && authUrl ? (
        <p>
          <a href={authUrl}>{t(lang, "loginWithGithub")}</a>
          <span className="hub-muted"> {t(lang, "adminAccount")}</span>
        </p>
      ) : null}
      {loading ? <p className="hub-muted">{t(lang, "loading")}</p> : null}

      <div className="hub-card hub-card-padded hub-mb">
        <div className="hub-flex-bar">
          <label>
            <span className="hub-muted hub-mr-sm">{t(lang, "status")}</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setOffset(0);
                setStatusFilter(event.target.value as "all" | "open" | "resolved");
              }}
            >
              <option value="all">{t(lang, "all")}</option>
              <option value="open">{t(lang, "open")}</option>
              <option value="resolved">{t(lang, "resolved")}</option>
            </select>
          </label>
          <label>
            <span className="hub-muted hub-mr-sm">{t(lang, "sort")}</span>
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(event) => {
                setOffset(0);
                const [nextSortBy, nextSortOrder] = event.target.value.split(":");
                setSortBy(nextSortBy === "status" ? "status" : "createdAt");
                setSortOrder(nextSortOrder === "asc" ? "asc" : "desc");
              }}
            >
              <option value="createdAt:desc">{t(lang, "newestFirst")}</option>
              <option value="createdAt:asc">{t(lang, "oldestFirst")}</option>
              <option value="status:asc">{t(lang, "statusAsc")}</option>
              <option value="status:desc">{t(lang, "statusDesc")}</option>
            </select>
          </label>
          <label>
            <span className="hub-muted hub-mr-sm">{t(lang, "search")}</span>
            <input
              value={queryInput}
              onChange={(event) => {
                setOffset(0);
                setQueryInput(event.target.value);
              }}
              placeholder={t(lang, "searchPlaceholder")}
            />
          </label>
          <span className="hub-muted">{lang === "en" ? `Total ${total}` : `共 ${total} 条`}</span>
        </div>
      </div>

      <div className="hub-flex-bar hub-mb">
        <button className="hub-viz-button" disabled={selectedIds.length === 0 || busyId !== null} onClick={() => batchResolve(false)}>
          {lang === "en" ? `Resolve Selected (${selectedIds.length})` : `批量仅处理（${selectedIds.length}）`}
        </button>
        <button className="hub-viz-button" disabled={selectedIds.length === 0 || busyId !== null} onClick={() => batchResolve(true)}>
          {lang === "en" ? `Resolve + Reverify Selected (${selectedIds.length})` : `批量处理并复验（${selectedIds.length}）`}
        </button>
      </div>

      <div className="hub-card hub-table-wrap">
        <table className="hub-table">
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
              <th>{t(lang, "run")}</th>
              <th>{t(lang, "reason")}</th>
              <th>{t(lang, "status")}</th>
              <th>{t(lang, "created")}</th>
              <th>{t(lang, "action")}</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={7} className="hub-muted">
                  {t(lang, "noReports")}
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
                    <div className="hub-action-grid">
                      <div>
                        <button className="hub-viz-button" disabled={evidenceLoading} onClick={() => openEvidence(report.runId)}>
                          {t(lang, "evidence")}
                        </button>
                      </div>
                      {report.status === "resolved" ? (
                        <span className="hub-muted">{t(lang, "resolved")}</span>
                      ) : (
                        <div className="hub-flex-bar">
                          <button className="hub-viz-button" disabled={busyId === report.id} onClick={() => resolveReport(report.id, false)}>
                            {t(lang, "resolve")}
                          </button>
                          <button className="hub-viz-button" disabled={busyId === report.id} onClick={() => resolveReport(report.id, true)}>
                            {t(lang, "resolveReverify")}
                          </button>
                        </div>
                      )}
                      <div className="hub-muted hub-text-sm">
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
      </div>

      {selectedEvidence ? (
        <section className="hub-card hub-card-padded hub-mt">
          <h3>{t(lang, "evidenceDetail")}</h3>
          <p className="hub-muted">{selectedEvidence.runId} · {selectedEvidence.model} · {selectedEvidence.score.toFixed(1)}</p>
          <div>
            <strong>{t(lang, "timeline")}</strong>
            <ul>
              {(selectedEvidence.evidenceChain?.timeline ?? []).map((item, index) => (
                <li key={`${item.phase}-${index}`}>
                  {item.phase} · {new Date(item.startedAt).toLocaleTimeString()} - {new Date(item.completedAt).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <strong>{t(lang, "samples")}</strong>
            <ul>
              {(selectedEvidence.evidenceChain?.samples ?? []).slice(0, 2).map((sample) => (
                <li key={sample.roundIndex}>#{sample.roundIndex} · {sample.requirement.slice(0, 80)}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <div className="hub-flex-bar hub-mt">
        <button className="hub-viz-button" disabled={offset <= 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - limit))}>
          {t(lang, "prev")}
        </button>
        <button className="hub-viz-button" disabled={offset + limit >= total || loading} onClick={() => setOffset((value) => value + limit)}>
          {t(lang, "next")}
        </button>
      </div>
    </section>
  );
}
