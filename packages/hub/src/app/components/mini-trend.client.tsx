"use client";

import type { Lang } from "../i18n";
import { t } from "../locales";

type MiniTrendProps = {
  points: number[];
  lang?: Lang;
};

export function MiniTrend({ points, lang = "zh" }: MiniTrendProps) {
  if (points.length === 0) {
    return <span className="hub-muted">{t(lang, "noData")}</span>;
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
    <svg
      className="hub-viz-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={lang === "en" ? `Trend sparkline with ${points.length} points` : `包含 ${points.length} 个点的趋势图`}
    >
      <path d={path} />
    </svg>
  );
}
