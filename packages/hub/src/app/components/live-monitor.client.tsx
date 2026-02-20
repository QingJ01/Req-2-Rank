"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lang } from "../i18n.js";
import type { LeaderboardRowView, LiveProgressSnapshot, SubmissionDetailView } from "./viz-types.js";
import { statusBadgeClass, statusLabel } from "./viz-utils.js";
import { TimelinePlayback } from "./timeline-playback.client.js";

type LiveMonitorProps = {
  initialModel?: string;
  lang?: Lang;
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

  function progressLabel(status: LiveProgressSnapshot["status"]): string {
    if (lang === "en") {
      if (status === "running") return "running";
      if (status === "completed") return "completed";
      if (status === "failed") return "failed";
      return "idle";
    }
    if (status === "running") return "运行中";
    if (status === "completed") return "已完成";
    if (status === "failed") return "失败";
    return "空闲";
  }

  function eventStateLabel(state: "started" | "completed" | "failed"): string {
    if (lang === "en") {
      if (state === "started") return "started";
      if (state === "completed") return "completed";
      return "failed";
    }
    if (state === "started") return "开始";
    if (state === "completed") return "完成";
    return "失败";
  }

  function phaseLabel(phase: "generate" | "execute" | "evaluate" | "score"): string {
    if (lang === "en") {
      return phase;
    }
    if (phase === "generate") return "生成";
    if (phase === "execute") return "执行";
    if (phase === "evaluate") return "评估";
    return "评分";
  }

  return (
    <section className="hub-grid cols-2">
      <section className="hub-card" style={{ padding: 14 }}>
        <div className="hub-viz-panel-head">
          <h2>{lang === "en" ? "Realtime Watch" : "实时监控"}</h2>
          <label>
            <span className="hub-muted" style={{ marginRight: 6 }}>{lang === "en" ? "Model" : "模型"}</span>
            <select value={streamModel} onChange={(event) => setModel(event.target.value)}>
              {selectableModels.length === 0 ? <option value="">-</option> : null}
              {selectableModels.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="hub-muted">{lang === "en" ? "Stream status" : "连接状态"}：{connected ? (lang === "en" ? "connected" : "已连接") : (lang === "en" ? "disconnected" : "未连接")}。</p>

        {liveProgress ? (
          <div className="hub-viz-live-progress">
            <div><strong>{lang === "en" ? "Pipeline" : "流水线"}</strong>：{progressLabel(liveProgress.status)}</div>
            <div><strong>{lang === "en" ? "Model" : "模型"}</strong>：{liveProgress.model ?? "-"}</div>
            <div><strong>{lang === "en" ? "Run" : "运行"}</strong>：{liveProgress.runId ?? "-"}</div>
            <div><strong>{lang === "en" ? "Updated" : "更新时间"}</strong>：{new Date(liveProgress.updatedAt).toLocaleTimeString()}</div>
          </div>
        ) : (
          <p className="hub-muted">{lang === "en" ? "No active pipeline progress detected." : "暂无活跃流水线进度。"}</p>
        )}

        <table className="hub-table">
          <thead>
            <tr>
              <th>{lang === "en" ? "Model" : "模型"}</th>
              <th>{lang === "en" ? "Score" : "得分"}</th>
              <th>{lang === "en" ? "Status" : "状态"}</th>
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
        <section className="hub-card" style={{ padding: 14 }}>
          <p className="hub-muted">{lang === "en" ? "No run selected." : "未选择运行记录。"}</p>
        </section>
      )}

      <section className="hub-card" style={{ padding: 14 }}>
        <h3>{lang === "en" ? "Stage Event Feed" : "阶段事件流"}</h3>
        <ul className="hub-viz-timeline-list">
          {(liveProgress?.events ?? []).slice(-10).reverse().map((event, index) => (
            <li key={`${event.timestamp}-${index}`} className={event.state === "failed" ? "hub-viz-phase active" : "hub-viz-phase"}>
              <div className="hub-viz-phase-title">
                {lang === "en"
                  ? `R${event.roundIndex + 1}/${event.totalRounds} ${phaseLabel(event.phase)}`
                  : `第 ${event.roundIndex + 1}/${event.totalRounds} 轮 · ${phaseLabel(event.phase)}`}
              </div>
              <div className="hub-viz-phase-meta">{eventStateLabel(event.state)}</div>
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
