"use client";

import type { Lang } from "../i18n.js";
import { getDimensions, safeScore } from "./viz-utils.js";

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

  const points = dimensions.map((dim, index) => {
    const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
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
    <svg viewBox={`0 0 ${size} ${size}`} className="hub-viz-radar" aria-label="dimension radar chart">
      {rings.map((ring) => (
        <polygon
              key={ring}
              points={points
                .map((point, index) => {
                  const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
              const ringRadius = (radius * ring) / 100;
              const x = center + Math.cos(angle) * ringRadius;
              const y = center + Math.sin(angle) * ringRadius;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ")}
          className="hub-viz-radar-ring"
        />
      ))}
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
