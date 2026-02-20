"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "../i18n";
import type { SubmissionDetailView } from "./viz-types";
import { t } from "../locales";

type TimelinePlaybackProps = {
  submission: SubmissionDetailView;
  lang?: Lang;
};

export function TimelinePlayback({ submission, lang = "zh" }: TimelinePlaybackProps) {
  const [playbackMs, setPlaybackMs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeline = submission.evidenceChain?.timeline ?? [];

  const durationMs = (() => {
    if (timeline.length === 0) {
      return 1;
    }
    const start = new Date(timeline[0].startedAt).getTime();
    const end = new Date(timeline[timeline.length - 1].completedAt).getTime();
    return Math.max(end - start, 1);
  })();

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  function startPlayback() {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }
    setPlaybackMs(0);
    timerRef.current = setInterval(() => {
      setPlaybackMs((current) => {
        if (current === null) {
          return null;
        }
        const next = current + 120;
        if (next >= durationMs + 500) {
          if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return durationMs + 500;
        }
        return next;
      });
    }, 120);
  }

  const phaseBase = timeline.length > 0 ? new Date(timeline[0].startedAt).getTime() : 0;

  const phaseKeys: Record<string, "phaseGenerate" | "phaseExecute" | "phaseEvaluate" | "phaseScore"> = {
    generate: "phaseGenerate",
    execute: "phaseExecute",
    evaluate: "phaseEvaluate",
    score: "phaseScore",
  };

  return (
    <section className="hub-card hub-card-padded">
      <div className="hub-viz-panel-head">
        <h3>{t(lang, "evalPlayback")}</h3>
        <button className="hub-viz-button" onClick={startPlayback}>
          {t(lang, "replay")}
        </button>
      </div>
      {timeline.length === 0 ? (
        <p className="hub-muted">{t(lang, "noTimeline")}</p>
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
                <div className="hub-viz-phase-title">{t(lang, phaseKeys[phase.phase] ?? "phaseScore")}</div>
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
