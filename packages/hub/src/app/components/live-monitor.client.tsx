"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lang } from "../i18n";
import type { LeaderboardRowView, LiveProgressSnapshot, SubmissionDetailView } from "./viz-types";
import { statusBadgeClass, statusLabel } from "./viz-utils";
import { TimelinePlayback } from "./timeline-playback.client";
import { t, type MessageKey } from "../locales";

type LiveMonitorProps = {
  initialModel?: string;
  lang?: Lang;
};

const phaseKeys: Record<string, MessageKey> = {
  generate: "phaseGenerate",
  execute: "phaseExecute",
  evaluate: "phaseEvaluate",
  score: "phaseScore",
};

const progressKeys: Record<string, MessageKey> = {
  running: "running",
  completed: "completed",
  failed: "failed",
  idle: "idle",
};

const eventStateKeys: Record<string, MessageKey> = {
  started: "started",
  completed: "completed",
  failed: "failed",
};

export function LiveMonitor({ initialModel, lang = "zh" }: LiveMonitorProps) {
  const [model, setModel] = useState(initialModel ?? "");
  const [rows, setRows] = useState<LeaderboardRowView[]>([]);
  const [submissionsByModel, setSubmissionsByModel] = useState<Record<string, SubmissionDetailView[]>>({});
  const [connected, setConnected] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveProgressSnapshot | null>(null);

  const streamModel = model || rows[0]?.model || "";

  useEffect(() => {
    const query = streamModel ? `?model=${encodeURIComponent(streamModel)}&limit=30` : "?limit=30";
    const source = new EventSource(`/api/live/stream${query}`);

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
      <section className="hub-card hub-card-padded">
        <div className="hub-viz-panel-head">
          <h2>{t(lang, "realtimeWatch")}</h2>
          <label>
            <span className="hub-muted" style={{ marginRight: 6 }}>{t(lang, "model")}</span>
            <select value={streamModel} onChange={(event) => setModel(event.target.value)}>
              {selectableModels.length === 0 ? <option value="">-</option> : null}
              {selectableModels.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="hub-muted">{t(lang, "streamStatus")}：{connected ? t(lang, "connected") : t(lang, "disconnected")}。</p>

        {liveProgress ? (
          <div className="hub-viz-live-progress">
            <div><strong>{t(lang, "pipeline")}</strong>：{t(lang, progressKeys[liveProgress.status] ?? "idle")}</div>
            <div><strong>{t(lang, "model")}</strong>：{liveProgress.model ?? "-"}</div>
            <div><strong>{t(lang, "run")}</strong>：{liveProgress.runId ?? "-"}</div>
            <div><strong>{t(lang, "updated")}</strong>：{new Date(liveProgress.updatedAt).toLocaleTimeString()}</div>
          </div>
        ) : (
          <p className="hub-muted">{t(lang, "noProgress")}</p>
        )}

        <table className="hub-table">
          <thead>
            <tr>
              <th>{t(lang, "model")}</th>
              <th>{t(lang, "score")}</th>
              <th>{t(lang, "status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row) => (
              <tr key={row.model}>
                <td>{row.model}</td>
                <td>{row.score.toFixed(1)}</td>
                <td><span className={statusBadgeClass(row.verificationStatus)}>{statusLabel(row.verificationStatus, lang)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedSubmission ? (
        <TimelinePlayback submission={selectedSubmission} lang={lang} />
      ) : (
        <section className="hub-card hub-card-padded">
          <p className="hub-muted">{t(lang, "noRunSelected")}</p>
        </section>
      )}

      <section className="hub-card hub-card-padded">
        <h3>{t(lang, "stageEventFeed")}</h3>
        <ul className="hub-viz-timeline-list">
          {(liveProgress?.events ?? []).slice(-10).reverse().map((event, index) => (
            <li key={`${event.timestamp}-${index}`} className={event.state === "failed" ? "hub-viz-phase active" : "hub-viz-phase"}>
              <div className="hub-viz-phase-title">
                {lang === "en"
                  ? `R${event.roundIndex + 1}/${event.totalRounds} ${t(lang, phaseKeys[event.phase] ?? "phaseScore")}`
                  : `第 ${event.roundIndex + 1}/${event.totalRounds} 轮 · ${t(lang, phaseKeys[event.phase] ?? "phaseScore")}`}
              </div>
              <div className="hub-viz-phase-meta">{t(lang, eventStateKeys[event.state] ?? "started")}</div>
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
