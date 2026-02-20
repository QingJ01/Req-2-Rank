"use client";

import type { Lang } from "../i18n";
import { getDimensions, safeScore } from "./viz-utils";

type DimensionBarsProps = {
  values: Record<string, number>;
  lang?: Lang;
};

export function DimensionBars({ values, lang = "zh" }: DimensionBarsProps) {
  const dimensions = getDimensions(lang);
  return (
    <div className="hub-viz-dimension-list">
      {dimensions.map((dim) => {
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
