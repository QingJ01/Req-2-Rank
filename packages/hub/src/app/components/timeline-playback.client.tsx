"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lang } from "../i18n.js";
import type { SubmissionDetailView } from "./viz-types.js";

type TimelinePlaybackProps = {
  submission: SubmissionDetailView;
  lang?: Lang;
};

export function TimelinePlayback({ submission, lang = "zh" }: TimelinePlaybackProps) {
  const [playbackMs, setPlaybackMs] = useState<number | null>(null);
  const timeline = submission.evidenceChain?.timeline ?? [];

  const durationMs = useMemo(() => {
    if (timeline.length === 0) {
      return 1;
    }
    const start = new Date(timeline[0].startedAt).getTime();
    const end = new Date(timeline[timeline.length - 1].completedAt).getTime();
    return Math.max(end - start, 1);
  }, [timeline]);

  useEffect(() => {
    if (playbackMs === null) {
      return;
    }
    const timer = window.setInterval(() => {
      setPlaybackMs((current) => {
        if (current === null) {
          return null;
        }
        const next = current + 120;
        if (next >= durationMs + 500) {
          window.clearInterval(timer);
          return durationMs + 500;
        }
        return next;
      });
    }, 120);

    return () => window.clearInterval(timer);
  }, [durationMs, playbackMs]);

  const phaseBase = timeline.length > 0 ? new Date(timeline[0].startedAt).getTime() : 0;

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
    <section className="hub-card" style={{ padding: 14 }}>
      <div className="hub-viz-panel-head">
        <h3>{lang === "en" ? "Evaluation Playback" : "评测回放"}</h3>
        <button className="hub-viz-button" onClick={() => setPlaybackMs(0)}>
          {lang === "en" ? "Replay" : "重新播放"}
        </button>
      </div>
      {timeline.length === 0 ? (
        <p className="hub-muted">{lang === "en" ? "No timeline data available." : "暂无时间线数据。"}</p>
      ) : (
        <ul className="hub-viz-timeline-list">
          {timeline.map((phase) => {
            const begin = new Date(phase.startedAt).getTime() - phaseBase;
            const done = new Date(phase.completedAt).getTime() - phaseBase;
            const active = playbackMs !== null && playbackMs >= begin && playbackMs < done;
            const complete = playbackMs !== null && playbackMs >= done;
            const className = active ? "hub-viz-phase active" : complete ? "hub-viz-phase done" : "hub-viz-phase";

            return (
              <li key={`${phase.phase}-${phase.startedAt}`} className={className}>
                <div className="hub-viz-phase-title">{phaseLabel(phase.phase)}</div>
                <div className="hub-viz-phase-meta">{phase.model}</div>
                <div className="hub-viz-phase-time">
                  {new Date(phase.startedAt).toLocaleTimeString()} - {new Date(phase.completedAt).toLocaleTimeString()}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
