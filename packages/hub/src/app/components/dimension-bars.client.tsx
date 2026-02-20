"use client";

import { DIMENSIONS, safeScore } from "./viz-utils.js";

type DimensionBarsProps = {
  values: Record<string, number>;
};

export function DimensionBars({ values }: DimensionBarsProps) {
  return (
    <div className="hub-viz-dimension-list">
      {DIMENSIONS.map((dim) => {
        const value = safeScore(values[dim.key]);
        return (
          <div key={dim.key} className="hub-viz-dimension-row">
            <span>{dim.label}</span>
            <div className="hub-viz-bar">
              <span style={{ width: `${value}%` }} />
            </div>
            <strong>{value.toFixed(1)}</strong>
          </div>
        );
      })}
    </div>
  );
}
