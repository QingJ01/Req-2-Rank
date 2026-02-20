"use client";

import type { Lang } from "../i18n";
import { getDimensions, safeScore } from "./viz-utils";
import { t } from "../locales";

type RadarChartProps = {
  values: Record<string, number>;
  lang?: Lang;
};

export function RadarChart({ values, lang = "zh" }: RadarChartProps) {
  const dimensions = getDimensions(lang);
  const size = 260;
  const center = size / 2;
  const radius = 92;
  const rings = [25, 50, 75, 100];

  const angles = dimensions.map((_, index) => (Math.PI * 2 * index) / dimensions.length - Math.PI / 2);

  const points = dimensions.map((dim, index) => {
    const angle = angles[index];
    const score = safeScore(values[dim.key]);
    return {
      label: dim.label,
      outerX: center + Math.cos(angle) * radius,
      outerY: center + Math.sin(angle) * radius,
      valueX: center + Math.cos(angle) * radius * (score / 100),
      valueY: center + Math.sin(angle) * radius * (score / 100),
    };
  });

  const polygon = points.map((point) => `${point.valueX.toFixed(1)},${point.valueY.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="hub-viz-radar" aria-label={t(lang, "radarChartLabel")}>
      {rings.map((ring) => {
        const ringRadius = (radius * ring) / 100;
        const ringPoints = angles
          .map((angle) => {
            const x = center + Math.cos(angle) * ringRadius;
            const y = center + Math.sin(angle) * ringRadius;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ");
        return <polygon key={ring} points={ringPoints} className="hub-viz-radar-ring" />;
      })}
      {points.map((point) => (
        <g key={point.label}>
          <line x1={center} y1={center} x2={point.outerX} y2={point.outerY} className="hub-viz-radar-axis" />
          <text x={point.outerX} y={point.outerY} className="hub-viz-radar-label" dominantBaseline="middle" textAnchor="middle">
            {point.label}
          </text>
        </g>
      ))}
      <polygon points={polygon} className="hub-viz-radar-area" />
    </svg>
  );
}
