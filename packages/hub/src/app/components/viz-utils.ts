import type { Lang } from "../i18n";
import type { ScoreDimension, VerificationStatus } from "./viz-types";

export const DIMENSION_KEYS: ScoreDimension[] = [
  "functionalCompleteness",
  "codeQuality",
  "logicAccuracy",
  "security",
  "engineeringPractice"
];

export function getDimensions(lang: Lang): Array<{ key: ScoreDimension; label: string }> {
  if (lang === "en") {
    return [
      { key: "functionalCompleteness", label: "Functional" },
      { key: "codeQuality", label: "Quality" },
      { key: "logicAccuracy", label: "Logic" },
      { key: "security", label: "Security" },
      { key: "engineeringPractice", label: "Engineering" }
    ];
  }
  return [
    { key: "functionalCompleteness", label: "功能完成度" },
    { key: "codeQuality", label: "代码质量" },
    { key: "logicAccuracy", label: "逻辑准确性" },
    { key: "security", label: "安全性" },
    { key: "engineeringPractice", label: "工程实践" }
  ];
}

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

export function statusLabel(status: VerificationStatus | undefined, lang: Lang): string {
  if (lang === "en") {
    if (status === "verified") {
      return "verified";
    }
    if (status === "disputed") {
      return "disputed";
    }
    return "pending";
  }
  if (status === "verified") {
    return "已验证";
  }
  if (status === "disputed") {
    return "有争议";
  }
  return "待验证";
}
