import type { ScoreDimension, VerificationStatus } from "./viz-types.js";

export const DIMENSIONS: Array<{ key: ScoreDimension; label: string }> = [
  { key: "functionalCompleteness", label: "Functional" },
  { key: "codeQuality", label: "Quality" },
  { key: "logicAccuracy", label: "Logic" },
  { key: "security", label: "Security" },
  { key: "engineeringPractice", label: "Engineering" }
];

export function safeScore(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export function statusBadgeClass(status?: VerificationStatus): string {
  if (status === "verified") {
    return "hub-viz-badge hub-viz-badge-verified";
  }
  if (status === "disputed") {
    return "hub-viz-badge hub-viz-badge-disputed";
  }
  return "hub-viz-badge hub-viz-badge-pending";
}
