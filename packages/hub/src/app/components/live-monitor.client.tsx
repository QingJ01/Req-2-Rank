"use client";

import { useEffect, useMemo, useState } from "react";
import type { LeaderboardRowView, LiveProgressSnapshot, SubmissionDetailView } from "./viz-types.js";
import { statusBadgeClass } from "./viz-utils.js";
import { TimelinePlayback } from "./timeline-playback.client.js";

type LiveMonitorProps = {
  initialModel?: string;
};

export function LiveMonitor({ initialModel }: LiveMonitorProps) {
  const [model, setModel] = useState(initialModel ?? "");
  const [rows, setRows] = useState<LeaderboardRowView[]>([]);
  const [submissionsByModel, setSubmissionsByModel] = useState<Record<string, SubmissionDetailView[]>>({});
  const [connected, setConnected] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveProgressSnapshot | null>(null);

  const streamModel = model || rows[0]?.model || "";

  useEffect(() => {
    const query = streamModel ? `?model=${encodeURIComponent(streamModel)}&limit=30` : "?limit=30";
    const source = new EventSource(`/api/public/live/stream${query}`);

    source.addEventListener("open", () => {
      setConnected(true);
    });

    source.addEventListener("leaderboard", (event) => {
      const message = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(message.data) as LeaderboardRowView[];
        if (Array.isArray(payload)) {
          setRows(payload);
        }
      } catch {
        // Ignore malformed event frames
      }
    });

    source.addEventListener("model-submissions", (event) => {
      const message = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(message.data) as { model?: string; submissions?: SubmissionDetailView[] };
        if (payload.model && Array.isArray(payload.submissions)) {
          setSubmissionsByModel((prev) => ({
            ...prev,
            [payload.model as string]: payload.submissions as SubmissionDetailView[]
          }));
        }
      } catch {
        // Ignore malformed event frames
      }
    });

    source.addEventListener("pipeline-progress", (event) => {
      const message = event as MessageEvent<string>;
      try {
        const payload = JSON.parse(message.data) as LiveProgressSnapshot | null;
        setLiveProgress(payload);
      } catch {
        // Ignore malformed event frames
      }
    });

    source.addEventListener("error", () => {
      setConnected(false);
    });

    return () => {
      source.close();
      setConnected(false);
    };
  }, [streamModel]);

  const submissionList = submissionsByModel[streamModel] ?? [];
  const selectedSubmission = submissionList[0];
  const selectableModels = useMemo(() => rows.map((item) => item.model), [rows]);

  return (
    <section className="hub-grid cols-2">
      <section className="hub-card" style={{ padding: 14 }}>
        <div className="hub-viz-panel-head">
          <h2>Realtime Watch</h2>
          <label>
            <span className="hub-muted" style={{ marginRight: 6 }}>Model</span>
            <select value={streamModel} onChange={(event) => setModel(event.target.value)}>
              {selectableModels.length === 0 ? <option value="">-</option> : null}
              {selectableModels.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="hub-muted">Stream status: {connected ? "connected" : "disconnected"}.</p>

        {liveProgress ? (
          <div className="hub-viz-live-progress">
            <div><strong>Pipeline</strong>: {liveProgress.status}</div>
            <div><strong>Model</strong>: {liveProgress.model ?? "-"}</div>
            <div><strong>Run</strong>: {liveProgress.runId ?? "-"}</div>
            <div><strong>Updated</strong>: {new Date(liveProgress.updatedAt).toLocaleTimeString()}</div>
          </div>
        ) : (
          <p className="hub-muted">No active pipeline progress detected.</p>
        )}

        <table className="hub-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row) => (
              <tr key={row.model}>
                <td>{row.model}</td>
                <td>{row.score.toFixed(1)}</td>
                <td><span className={statusBadgeClass(row.verificationStatus)}>{row.verificationStatus ?? "pending"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedSubmission ? (
        <TimelinePlayback submission={selectedSubmission} />
      ) : (
        <section className="hub-card" style={{ padding: 14 }}>
          <p className="hub-muted">No run selected.</p>
        </section>
      )}

      <section className="hub-card" style={{ padding: 14 }}>
        <h3>Stage Event Feed</h3>
        <ul className="hub-viz-timeline-list">
          {(liveProgress?.events ?? []).slice(-10).reverse().map((event, index) => (
            <li key={`${event.timestamp}-${index}`} className={event.state === "failed" ? "hub-viz-phase active" : "hub-viz-phase"}>
              <div className="hub-viz-phase-title">R{event.roundIndex + 1}/{event.totalRounds} {event.phase}</div>
              <div className="hub-viz-phase-meta">{event.state}</div>
              <div className="hub-viz-phase-time">
                {new Date(event.timestamp).toLocaleTimeString()} {event.message ? `- ${event.message}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
