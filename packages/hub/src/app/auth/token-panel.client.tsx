"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    let cancelled = false;

    async function issueToken(): Promise<void> {
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
        if (cancelled) {
          return;
        }
        if (!response.ok || !payload.ok || !payload.data?.token) {
          setError(payload.error?.message ?? "Token generation failed");
          return;
        }
        setToken(payload.data.token);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Token generation failed");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void issueToken();
    return () => {
      cancelled = true;
    };
  }, [actorId]);

  return (
    <div className="hub-token-panel">
      {loading ? <p className="hub-muted">{lang === "en" ? "Generating token..." : "正在生成 token..."}</p> : null}
      {error ? <p className="hub-muted">{lang === "en" ? `Token error: ${error}` : `Token 错误：${error}`}</p> : null}
      {token ? <TokenCopy token={token} lang={lang} /> : null}
      <ConfigGenerator lang={lang} initialHubToken={token} />
    </div>
  );
}
