"use client";

import { useState } from "react";

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

export function SampleCard({ sample }: { sample: Sample }) {
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
    <details
      style={{
        padding: 10,
        borderRadius: 8,
        border: "1px solid rgba(31,36,48,0.12)",
        backgroundColor: "rgba(255,255,255,0.65)"
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 600 }}>Sample {sample.roundIndex}</summary>
      <div style={{ marginTop: 8 }}>
        <strong>Requirement</strong>
        <pre
          style={{
            margin: "6px 0 10px 0",
            whiteSpace: "pre-wrap",
            backgroundColor: "rgba(31,36,48,0.06)",
            borderRadius: 6,
            padding: 8
          }}
        >
          {sample.requirement}
        </pre>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong>Code Submission</strong>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              border: "1px solid rgba(31,36,48,0.25)",
              background: "rgba(255,255,255,0.9)",
              borderRadius: 6,
              padding: "2px 8px",
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            {copied ? "Copied" : "Copy code"}
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
