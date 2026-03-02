"use client";

import { useState } from "react";
import type { Lang } from "../i18n";
import { TokenCopy } from "./token-copy.client";
import { ConfigGenerator } from "./config-generator.client";

type AuthTokenPanelProps = {
  lang: Lang;
  actorId: string;
};

type TokenResponse = {
  ok: boolean;
  data?: { token: string; actorId: string };
  error?: { message?: string };
};

export function AuthTokenPanel({ lang, actorId }: AuthTokenPanelProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  async function handleGenerate(): Promise<void> {
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch("/api/tokens", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-actor-id": actorId
        },
        body: JSON.stringify({ actorIdHint: actorId }),
        credentials: "include"
      });
      const payload = (await response.json()) as TokenResponse;
      if (!response.ok || !payload.ok || !payload.data?.token) {
        setError(payload.error?.message ?? "Token generation failed");
        return;
      }
      setToken(payload.data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hub-token-panel">
      <div className="hub-flex-between hub-mb">
        <strong>{lang === "en" ? "Token" : "Token"}</strong>
        <button type="button" className="hub-viz-button" onClick={handleGenerate} disabled={loading}>
          {loading ? (lang === "en" ? "Generating..." : "正在生成...") : lang === "en" ? "Generate token" : "生成 Token"}
        </button>
      </div>
      {error ? <p className="hub-muted">{lang === "en" ? `Token error: ${error}` : `Token 错误：${error}`}</p> : null}
      {token ? <TokenCopy token={token} lang={lang} /> : null}
      <ConfigGenerator lang={lang} initialHubToken={token} />
    </div>
  );
}
