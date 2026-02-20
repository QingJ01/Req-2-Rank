"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HUB_LANG_EVENT, pickLang, type Lang } from "./i18n";
import { t } from "./locales";

type SessionPayload = {
  ok: boolean;
  data?: { actorId?: string };
};

export function resolveActorLandingPath(actorId?: string): string {
  if (!actorId) {
    return "/auth";
  }
  return actorId.toLowerCase() === "qingj01" ? "/admin" : "/auth";
}

export function AuthStatusClient() {
  const router = useRouter();
  const [actorId, setActorId] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const syncLang = () => {
      setLang(pickLang(window.localStorage.getItem("hub.lang")));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "hub.lang") {
        syncLang();
      }
    };

    syncLang();
    window.addEventListener("storage", onStorage);
    window.addEventListener(HUB_LANG_EVENT, syncLang);

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

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HUB_LANG_EVENT, syncLang);
    };
  }, []);

  function toggleLang(): void {
    const nextLang: Lang = lang === "zh" ? "en" : "zh";
    window.localStorage.setItem("hub.lang", nextLang);
    document.cookie = `hub.lang=${nextLang};path=/;max-age=31536000;SameSite=Lax`;
    setLang(nextLang);
    window.dispatchEvent(new Event(HUB_LANG_EVENT));
    router.refresh();
  }

  const authNode = !actorId ? (
    <Link className="hub-nav-link" href="/auth">
      {t(lang, "login")}
    </Link>
  ) : (
    <span className="hub-muted">
      <Link className="hub-nav-link" href={resolveActorLandingPath(actorId)}>
        {t(lang, "signedInAs")} {actorId}
      </Link>
      {" "}·{" "}
      <a href="/api/auth/github?action=logout&redirect=/auth">{t(lang, "logout")}</a>
    </span>
  );

  return (
    <div className="hub-header-actions">
      {authNode}
      <button className="hub-lang-toggle" onClick={toggleLang} type="button">
        {lang === "zh" ? "EN" : "中文"}
      </button>
    </div>
  );
}
