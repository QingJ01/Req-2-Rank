"use client";

import { useState } from "react";
import type { Lang } from "../i18n";
import { t } from "../locales";

type TokenCopyProps = {
  token: string;
  lang: Lang;
};

export function TokenCopy({ token, lang }: TokenCopyProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="hub-token-panel">
      <div className="hub-flex-between hub-mb">
        <strong>{t(lang, "tokenLabel")}</strong>
        <button type="button" className="hub-viz-button" onClick={handleCopy}>
          {copied ? t(lang, "copied") : t(lang, "copyToken")}
        </button>
      </div>
      <input className="hub-token-input" value={token} readOnly aria-label={t(lang, "tokenLabel")} />
    </div>
  );
}
