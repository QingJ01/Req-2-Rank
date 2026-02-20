"use client";

import { useState } from "react";
import type { Lang } from "../../i18n.js";

type Sample = {
  roundIndex: number;
  requirement: string;
  codeSubmission: string;
};

function detectLanguage(code: string): string {
  const trimmed = code.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }
  if (trimmed.includes("def ") || trimmed.includes("import ") && trimmed.includes("print(")) {
    return "py";
  }
  if (trimmed.includes("export ") || trimmed.includes(":") || trimmed.includes("interface ")) {
    return "ts";
  }
  if (trimmed.includes("function ") || trimmed.includes("const ") || trimmed.includes("=>")) {
    return "js";
  }
  return "txt";
}

export function SampleCard({ sample, lang = "zh" }: { sample: Sample; lang?: Lang }) {
  const isEn = lang === "en";
  const [copied, setCopied] = useState(false);
  const language = detectLanguage(sample.codeSubmission);

  async function handleCopy(): Promise<void> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(sample.codeSubmission);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {
      setCopied(false);
    }
  }

  return (
    <details className="sample-shell">
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>{isEn ? `Sample ${sample.roundIndex}` : `样本 ${sample.roundIndex}`}</summary>
      <div>
        <strong>{isEn ? "Requirement" : "需求"}</strong>
        <pre className="sample-pre">
          {sample.requirement}
        </pre>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong>{isEn ? "Code Submission" : "提交代码"}</strong>
          <button type="button" onClick={handleCopy} className="sample-button">
            {copied ? (isEn ? "Copied" : "已复制") : (isEn ? "Copy code" : "复制代码")}
          </button>
        </div>
        <pre
          className={`language-${language}`}
          style={{
            margin: "6px 0 0 0",
            whiteSpace: "pre-wrap",
            backgroundColor: "rgba(31,36,48,0.06)",
            borderRadius: 6,
            padding: 8,
            maxHeight: 260,
            overflow: "auto"
          }}
        >
          {sample.codeSubmission}
        </pre>
      </div>
    </details>
  );
}
