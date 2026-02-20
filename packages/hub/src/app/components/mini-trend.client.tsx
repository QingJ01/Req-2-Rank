"use client";

type MiniTrendProps = {
  points: number[];
};

export function MiniTrend({ points }: MiniTrendProps) {
  if (points.length === 0) {
    return <span className="hub-muted">暂无</span>;
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
    <svg className="hub-viz-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={path} />
    </svg>
  );
}
