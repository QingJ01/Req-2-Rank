"use client";

import { useEffect, useMemo, useState } from "react";

type SessionPayload = {
  ok: boolean;
  data?: { actorId?: string };
};

export function AuthStatusClient() {
  const [actorId, setActorId] = useState<string | null>(null);

  const isEn = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URL(window.location.href).searchParams.get("lang") === "en";
  }, []);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch("/api/auth/github?action=session", { credentials: "include" });
        if (!response.ok) {
          setActorId(null);
          return;
        }
        const payload = (await response.json()) as SessionPayload;
        setActorId(payload.ok ? payload.data?.actorId ?? null : null);
      } catch {
        setActorId(null);
      }
    }

    void loadSession();
  }, []);

  if (!actorId) {
    return (
      <a className="hub-nav-link" href={`/auth?lang=${isEn ? "en" : "zh"}`}>
        {isEn ? "Login" : "登录"}
      </a>
    );
  }

  return (
    <span className="hub-muted">
      {isEn ? "Signed in as" : "已登录"} {actorId} · {" "}
      <a href={`/api/auth/github?action=logout&redirect=/auth?lang=${isEn ? "en" : "zh"}`}>{isEn ? "Logout" : "退出"}</a>
    </span>
  );
}
