"use client";

import type { SubmissionDetailView } from "./viz-types";
import { safeScore } from "./viz-utils";
import type { Lang } from "../i18n";
import { t } from "../locales";

type CiChartProps = {
  submissions: SubmissionDetailView[];
  lang?: Lang;
};

export function CiChart({ submissions, lang = "zh" }: CiChartProps) {
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
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="hub-viz-ci"
      aria-label={t(lang, "ciChartLabel")}
    >
      <line x1={left} y1={bottom} x2={right} y2={bottom} className="hub-viz-axis-line" />
      <line x1={left} y1={top} x2={left} y2={bottom} className="hub-viz-axis-line" />
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line x1={left - 5} y1={y(tick)} x2={right} y2={y(tick)} className="hub-viz-grid-line" />
          <text x={left - 10} y={y(tick)} className="hub-viz-tick" textAnchor="end" dominantBaseline="middle">
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
            <line x1={x} y1={y(low)} x2={x} y2={y(high)} className="hub-viz-ci-whisker" />
            <line x1={x - 6} y1={y(low)} x2={x + 6} y2={y(low)} className="hub-viz-ci-cap" />
            <line x1={x - 6} y1={y(high)} x2={x + 6} y2={y(high)} className="hub-viz-ci-cap" />
            <circle cx={x} cy={y(submission.score)} r={4} className="hub-viz-ci-dot" />
          </g>
        );
      })}
    </svg>
  );
}
