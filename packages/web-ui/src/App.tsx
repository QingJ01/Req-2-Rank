import { useEffect, useMemo, useState } from "react";

type VerificationStatus = "pending" | "verified" | "disputed";
type ScoreDimension = "functionalCompleteness" | "codeQuality" | "logicAccuracy" | "security" | "engineeringPractice";

type LeaderboardRow = {
  rank: number;
  model: string;
  score: number;
  ci95?: [number, number];
  verificationStatus?: VerificationStatus;
};

type SubmissionDetail = {
  runId: string;
  model: string;
  score: number;
  ci95: [number, number];
  agreementLevel: "high" | "moderate" | "low";
  dimensionScores: Record<string, number>;
  submittedAt: string;
  verificationStatus: VerificationStatus;
  evidenceChain?: {
    timeline: Array<{
      phase: "generate" | "execute" | "evaluate" | "score";
      startedAt: string;
      completedAt: string;
      model: string;
    }>;
    samples: Array<{
      roundIndex: number;
      requirement: string;
      codeSubmission: string;
    }>;
    environment: {
      os: string;
      nodeVersion: string;
      timezone: string;
    };
  };
};

type RouteState =
  | { page: "overview" }
  | { page: "history"; model?: string }
  | { page: "report"; model: string; runId?: string }
  | { page: "live"; model: string; runId?: string };

type LiveProgressSnapshot = {
  status: "idle" | "running" | "completed" | "failed";
  updatedAt: string;
  runId?: string;
  model?: string;
  error?: string;
  events: Array<{
    timestamp: string;
    roundIndex: number;
    totalRounds: number;
    phase: "generate" | "execute" | "evaluate" | "score";
    state: "started" | "completed" | "failed";
    message?: string;
  }>;
};

const DIMENSIONS: Array<{ key: ScoreDimension; label: string }> = [
  { key: "functionalCompleteness", label: "Functional" },
  { key: "codeQuality", label: "Quality" },
  { key: "logicAccuracy", label: "Logic" },
  { key: "security", label: "Security" },
  { key: "engineeringPractice", label: "Engineering" }
];

function parseHashRoute(hash: string): RouteState {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw || raw === "/") {
    return { page: "overview" };
  }

  const [pathPart, queryPart] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean).map((item) => decodeURIComponent(item));
  const query = new URLSearchParams(queryPart ?? "");

  if (parts[0] === "history") {
    const model = query.get("model") ?? undefined;
    return { page: "history", model };
  }

  if (parts[0] === "report" && parts[1]) {
    return { page: "report", model: parts[1], runId: parts[2] ?? undefined };
  }

  if (parts[0] === "live" && parts[1]) {
    return { page: "live", model: parts[1], runId: parts[2] ?? undefined };
  }

  return { page: "overview" };
}

function toHash(route: RouteState): string {
  if (route.page === "overview") {
    return "#/";
  }
  if (route.page === "history") {
    return route.model ? `#/history?model=${encodeURIComponent(route.model)}` : "#/history";
  }
  if (route.page === "report") {
    return route.runId
      ? `#/report/${encodeURIComponent(route.model)}/${encodeURIComponent(route.runId)}`
      : `#/report/${encodeURIComponent(route.model)}`;
  }
  return route.runId
    ? `#/live/${encodeURIComponent(route.model)}/${encodeURIComponent(route.runId)}`
    : `#/live/${encodeURIComponent(route.model)}`;
}

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const payload = await requestJson<{ ok?: boolean; data?: LeaderboardRow[]; error?: { message?: string } }>(
    "/api/public/leaderboard?limit=30&sort=desc"
  );
  if (!payload.data) {
    throw new Error(payload.error?.message ?? "Leaderboard API returned empty data");
  }
  return payload.data;
}

async function fetchModelSubmissions(model: string): Promise<SubmissionDetail[]> {
  const payload = await requestJson<{ ok?: boolean; data?: { submissions?: SubmissionDetail[] }; error?: { message?: string } }>(
    `/api/public/model/${encodeURIComponent(model)}`
  );
  if (!payload.data?.submissions) {
    throw new Error(payload.error?.message ?? "Model API returned empty data");
  }
  return payload.data.submissions;
}

function safeScore(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function statusClass(status?: VerificationStatus): string {
  if (status === "verified") return "badge badge-verified";
  if (status === "disputed") return "badge badge-disputed";
  return "badge badge-pending";
}

function MiniTrend({ points }: { points: number[] }) {
  if (points.length === 0) {
    return <span className="muted">n/a</span>;
  }
  const width = 120;
  const height = 34;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 100);
  const span = Math.max(max - min, 1);
  const path = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={path} />
    </svg>
  );
}

function RadarChart({ values }: { values: Record<string, number> }) {
  const size = 260;
  const center = size / 2;
  const radius = 92;
  const rings = [25, 50, 75, 100];

  const points = DIMENSIONS.map((dim, index) => {
    const angle = (Math.PI * 2 * index) / DIMENSIONS.length - Math.PI / 2;
    const score = safeScore(values[dim.key]);
    return {
      label: dim.label,
      outerX: center + Math.cos(angle) * radius,
      outerY: center + Math.sin(angle) * radius,
      valueX: center + Math.cos(angle) * radius * (score / 100),
      valueY: center + Math.sin(angle) * radius * (score / 100)
    };
  });

  const polygon = points.map((point) => `${point.valueX.toFixed(1)},${point.valueY.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar-chart" aria-label="dimension radar chart">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={points
            .map((point, index) => {
              const angle = (Math.PI * 2 * index) / DIMENSIONS.length - Math.PI / 2;
              const ringRadius = (radius * ring) / 100;
              const x = center + Math.cos(angle) * ringRadius;
              const y = center + Math.sin(angle) * ringRadius;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ")}
          className="radar-ring"
        />
      ))}
      {points.map((point) => (
        <g key={point.label}>
          <line x1={center} y1={center} x2={point.outerX} y2={point.outerY} className="radar-axis" />
          <text x={point.outerX} y={point.outerY} className="radar-label" dominantBaseline="middle" textAnchor="middle">
            {point.label}
          </text>
        </g>
      ))}
      <polygon points={polygon} className="radar-area" />
    </svg>
  );
}

function CiChart({ submissions }: { submissions: SubmissionDetail[] }) {
  const width = 600;
  const height = 220;
  const left = 48;
  const right = width - 20;
  const top = 16;
  const bottom = height - 24;
  const spanX = Math.max(right - left, 1);
  const spanY = Math.max(bottom - top, 1);

  const sorted = submissions.slice().sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const y = (score: number) => bottom - (safeScore(score) / 100) * spanY;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ci-chart" aria-label="confidence interval chart">
      <line x1={left} y1={bottom} x2={right} y2={bottom} className="axis-line" />
      <line x1={left} y1={top} x2={left} y2={bottom} className="axis-line" />
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line x1={left - 5} y1={y(tick)} x2={right} y2={y(tick)} className="grid-line" />
          <text x={left - 10} y={y(tick)} className="tick" textAnchor="end" dominantBaseline="middle">
            {tick}
          </text>
        </g>
      ))}
      {sorted.map((submission, index) => {
        const x = left + (index / Math.max(sorted.length - 1, 1)) * spanX;
        const low = submission.ci95?.[0] ?? submission.score;
        const high = submission.ci95?.[1] ?? submission.score;
        return (
          <g key={submission.runId}>
            <line x1={x} y1={y(low)} x2={x} y2={y(high)} className="ci-whisker" />
            <line x1={x - 6} y1={y(low)} x2={x + 6} y2={y(low)} className="ci-cap" />
            <line x1={x - 6} y1={y(high)} x2={x + 6} y2={y(high)} className="ci-cap" />
            <circle cx={x} cy={y(submission.score)} r={4} className="ci-dot" />
          </g>
        );
      })}
    </svg>
  );
}

function TimelinePlayback({ submission }: { submission: SubmissionDetail }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const timeline = submission.evidenceChain?.timeline ?? [];
  const durationMs = useMemo(() => {
    if (timeline.length === 0) return 1;
    const start = new Date(timeline[0].startedAt).getTime();
    const end = new Date(timeline[timeline.length - 1].completedAt).getTime();
    return Math.max(end - start, 1);
  }, [timeline]);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= durationMs + 500) {
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [durationMs, startedAt]);

  const elapsed = startedAt ? Date.now() - startedAt : 0;
  const phaseBase = timeline.length > 0 ? new Date(timeline[0].startedAt).getTime() : 0;

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Evaluation Playback</h3>
        <button className="button" onClick={() => setStartedAt(Date.now())}>
          Replay Timeline
        </button>
      </div>
      {timeline.length === 0 ? (
        <p className="muted">No timeline data available.</p>
      ) : (
        <ul className="timeline-list">
          {timeline.map((phase) => {
            const begin = new Date(phase.startedAt).getTime() - phaseBase;
            const done = new Date(phase.completedAt).getTime() - phaseBase;
            const active = startedAt !== null && elapsed >= begin && elapsed < done;
            const complete = startedAt !== null && elapsed >= done;
            return (
              <li key={`${phase.phase}-${phase.startedAt}`} className={active ? "phase active" : complete ? "phase done" : "phase"}>
                <div className="phase-title">{phase.phase}</div>
                <div className="phase-meta">{phase.model}</div>
                <div className="phase-time">{new Date(phase.startedAt).toLocaleTimeString()} - {new Date(phase.completedAt).toLocaleTimeString()}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function App() {
  const [route, setRoute] = useState<RouteState>(() => parseHashRoute(window.location.hash));
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [modelSubmissions, setModelSubmissions] = useState<Record<string, SubmissionDetail[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveProgressSnapshot | null>(null);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHashRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLeaderboard();
        if (!cancelled) {
          setRows(data);
          setLastRefresh(new Date().toLocaleTimeString());
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const currentModel =
    route.page === "history" ? route.model : route.page === "report" || route.page === "live" ? route.model : rows[0]?.model;

  useEffect(() => {
    if (!currentModel || modelSubmissions[currentModel]) return;
    let cancelled = false;
    void fetchModelSubmissions(currentModel)
      .then((submissions) => {
        if (cancelled) return;
        setModelSubmissions((prev) => ({ ...prev, [currentModel]: submissions }));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      });
    return () => {
      cancelled = true;
    };
  }, [currentModel, modelSubmissions]);

  useEffect(() => {
    if (route.page !== "live" || !currentModel) {
      setLiveConnected(false);
      return;
    }

    const streamUrl = `/api/public/live/stream?model=${encodeURIComponent(currentModel)}&limit=30`;
    const source = new EventSource(streamUrl);

    source.addEventListener("open", () => {
      setLiveConnected(true);
    });

    source.addEventListener("leaderboard", (event) => {
      const message = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(message.data) as LeaderboardRow[];
        if (Array.isArray(payload)) {
          setRows(payload);
          setLastRefresh(new Date().toLocaleTimeString());
        }
      } catch {
        // ignore malformed event frames
      }
    });

    source.addEventListener("model-submissions", (event) => {
      const message = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(message.data) as { model?: string; submissions?: SubmissionDetail[] };
        if (payload.model && Array.isArray(payload.submissions)) {
          setModelSubmissions((prev) => ({
            ...prev,
            [payload.model as string]: payload.submissions as SubmissionDetail[]
          }));
        }
      } catch {
        // ignore malformed event frames
      }
    });

    source.addEventListener("pipeline-progress", (event) => {
      const message = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(message.data) as LiveProgressSnapshot | null;
        setLiveProgress(payload);
      } catch {
        // ignore malformed event frames
      }
    });

    source.addEventListener("error", () => {
      setLiveConnected(false);
    });

    return () => {
      source.close();
      setLiveConnected(false);
    };
  }, [route.page, currentModel]);

  const submissions = currentModel ? modelSubmissions[currentModel] ?? [] : [];
  const selectedSubmission =
    route.page === "report" || route.page === "live"
      ? submissions.find((item) => item.runId === route.runId) ?? submissions[0]
      : submissions[0];

  const aggregatedDimensions = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const dimension of DIMENSIONS) {
      const values = submissions.map((item) => safeScore(item.dimensionScores[dimension.key]));
      stats[dimension.key] = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    }
    return stats;
  }, [submissions]);

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <h1>Req2Rank Workbench</h1>
          <p>Visualize ranking, confidence, and evidence timelines with local-first monitoring views.</p>
        </div>
        <div className="hero-meta">
          <div><span className="muted">Refresh</span> {lastRefresh || "-"}</div>
          <div><span className="muted">Models</span> {rows.length}</div>
        </div>
      </header>

      <nav className="tabs">
        <a href={toHash({ page: "overview" })} className={route.page === "overview" ? "tab active" : "tab"}>Overview</a>
        <a href={toHash({ page: "history", model: currentModel })} className={route.page === "history" ? "tab active" : "tab"}>Run History</a>
        <a href={toHash({ page: "report", model: currentModel ?? "" })} className={route.page === "report" ? "tab active" : "tab"}>Report</a>
        <a href={toHash({ page: "live", model: currentModel ?? "" })} className={route.page === "live" ? "tab active" : "tab"}>Live Progress</a>
      </nav>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading latest leaderboard...</p> : null}

      {route.page === "overview" && (
        <section className="grid two">
          <section className="panel">
            <div className="panel-head">
              <h3>Leaderboard</h3>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Model</th>
                  <th>Score</th>
                  <th>CI95</th>
                  <th>Status</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const trendPoints = (modelSubmissions[row.model] ?? []).map((item) => item.score);
                  return (
                    <tr key={`${row.model}-${row.rank}`}>
                      <td>{row.rank}</td>
                      <td>
                        <a href={toHash({ page: "history", model: row.model })}>{row.model}</a>
                      </td>
                      <td>{row.score.toFixed(1)}</td>
                      <td>
                        {row.ci95 ? `${row.ci95[0].toFixed(1)} - ${row.ci95[1].toFixed(1)}` : "-"}
                      </td>
                      <td><span className={statusClass(row.verificationStatus)}>{row.verificationStatus ?? "pending"}</span></td>
                      <td><MiniTrend points={trendPoints} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h3>Dimension Radar</h3>
            <RadarChart values={aggregatedDimensions} />
            <p className="muted">Average dimension scores for {currentModel ?? "selected model"}.</p>
          </section>
        </section>
      )}

      {route.page === "history" && (
        <section className="grid two">
          <section className="panel">
            <div className="panel-head">
              <h3>Submissions</h3>
              {currentModel ? <span className="chip">{currentModel}</span> : null}
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Score</th>
                  <th>CI95</th>
                  <th>Submitted</th>
                  <th>Report</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((item) => (
                  <tr key={item.runId}>
                    <td>{item.runId}</td>
                    <td>{item.score.toFixed(1)}</td>
                    <td>{item.ci95[0].toFixed(1)} - {item.ci95[1].toFixed(1)}</td>
                    <td>{new Date(item.submittedAt).toLocaleString()}</td>
                    <td>
                      <a href={toHash({ page: "report", model: item.model, runId: item.runId })}>Open</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h3>Score Trend + CI Error Bars</h3>
            <CiChart submissions={submissions} />
          </section>
        </section>
      )}

      {route.page === "report" && (
        <section className="grid two">
          <section className="panel">
            <div className="panel-head">
              <h3>Run Report</h3>
              {selectedSubmission ? <span className={statusClass(selectedSubmission.verificationStatus)}>{selectedSubmission.verificationStatus}</span> : null}
            </div>
            {selectedSubmission ? (
              <>
                <p><strong>Run</strong>: {selectedSubmission.runId}</p>
                <p><strong>Score</strong>: {selectedSubmission.score.toFixed(1)} ({selectedSubmission.ci95[0].toFixed(1)} - {selectedSubmission.ci95[1].toFixed(1)})</p>
                <p><strong>Agreement</strong>: {selectedSubmission.agreementLevel}</p>
                <div className="dimension-list">
                  {DIMENSIONS.map((dim) => (
                    <div key={dim.key} className="dimension-row">
                      <span>{dim.label}</span>
                      <div className="bar"><span style={{ width: `${safeScore(selectedSubmission.dimensionScores[dim.key])}%` }} /></div>
                      <strong>{safeScore(selectedSubmission.dimensionScores[dim.key]).toFixed(1)}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">No report data available.</p>
            )}
          </section>

          <section className="panel">
            <h3>Evidence Snapshot</h3>
            {selectedSubmission?.evidenceChain?.samples?.length ? (
              <div className="code-sample">
                <p><strong>Round</strong> #{selectedSubmission.evidenceChain.samples[0].roundIndex}</p>
                <details>
                  <summary>Requirement</summary>
                  <pre>{selectedSubmission.evidenceChain.samples[0].requirement}</pre>
                </details>
                <details>
                  <summary>Code Submission</summary>
                  <pre>{selectedSubmission.evidenceChain.samples[0].codeSubmission}</pre>
                </details>
              </div>
            ) : (
              <p className="muted">No evidence sample attached.</p>
            )}
          </section>
        </section>
      )}

      {route.page === "live" && (
        <section className="grid two">
          <section className="panel">
            <h3>Realtime Watch</h3>
            <p className="muted">
              Stream status: {liveConnected ? "connected" : "disconnected"}. SSE pushes leaderboard and model submissions.
            </p>
            {liveProgress ? (
              <div className="live-progress">
                <div><strong>Pipeline</strong>: {liveProgress.status}</div>
                <div><strong>Model</strong>: {liveProgress.model ?? "-"}</div>
                <div><strong>Run</strong>: {liveProgress.runId ?? "-"}</div>
                <div><strong>Updated</strong>: {new Date(liveProgress.updatedAt).toLocaleTimeString()}</div>
              </div>
            ) : (
              <p className="muted">No active pipeline progress detected.</p>
            )}
            <table className="table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Live</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((row) => (
                  <tr key={row.model}>
                    <td>{row.model}</td>
                    <td>{row.score.toFixed(1)}</td>
                    <td><span className={statusClass(row.verificationStatus)}>{row.verificationStatus ?? "pending"}</span></td>
                    <td>
                      <a href={toHash({ page: "live", model: row.model })}>Inspect</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {selectedSubmission ? <TimelinePlayback submission={selectedSubmission} /> : <section className="panel"><p className="muted">No run selected.</p></section>}
          <section className="panel">
            <h3>Stage Event Feed</h3>
            <ul className="timeline-list">
              {(liveProgress?.events ?? []).slice(-8).reverse().map((event, index) => (
                <li key={`${event.timestamp}-${index}`} className={event.state === "failed" ? "phase active" : "phase"}>
                  <div className="phase-title">R{event.roundIndex + 1}/{event.totalRounds} {event.phase}</div>
                  <div className="phase-meta">{event.state}</div>
                  <div className="phase-time">{new Date(event.timestamp).toLocaleTimeString()} {event.message ? `- ${event.message}` : ""}</div>
                </li>
              ))}
            </ul>
          </section>
        </section>
      )}
    </main>
  );
}
