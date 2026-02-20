"use client";

import { useEffect, useMemo, useState } from "react";
import type { SubmissionDetailView } from "./viz-types.js";

type TimelinePlaybackProps = {
  submission: SubmissionDetailView;
};

export function TimelinePlayback({ submission }: TimelinePlaybackProps) {
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

  return (
    <section className="hub-card" style={{ padding: 14 }}>
      <div className="hub-viz-panel-head">
        <h3>Evaluation Playback</h3>
        <button className="hub-viz-button" onClick={() => setPlaybackMs(0)}>
          Replay Timeline
        </button>
      </div>
      {timeline.length === 0 ? (
        <p className="hub-muted">No timeline data available.</p>
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
                <div className="hub-viz-phase-title">{phase.phase}</div>
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
