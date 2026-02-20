"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { HUB_LANG_EVENT, isActivePath, pickLang, type Lang } from "./i18n";
import { t } from "./locales";

type TopModel = {
  model: string;
};

type HeaderNavProps = {
  topModels: TopModel[];
};

export function HeaderNav({ topModels }: HeaderNavProps) {
  const pathname = usePathname() ?? "/";
  const [storedLang, setStoredLang] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncLang = () => {
      setStoredLang(window.localStorage.getItem("hub.lang"));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === "hub.lang") {
        syncLang();
      }
    };

    syncLang();
    window.addEventListener("storage", onStorage);
    window.addEventListener(HUB_LANG_EVENT, syncLang);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(HUB_LANG_EVENT, syncLang);
    };
  }, []);

  const lang = pickLang(storedLang);
  const primaryModels = topModels.slice(0, 2);
  const extraModels = topModels.slice(2);
  const isExtraModelActive = extraModels.some((item) => isActivePath(pathname, `/model/${encodeURIComponent(item.model)}`));

  return (
    <nav className="hub-nav">
      <Link className={isActivePath(pathname, "/") ? "hub-nav-link active" : "hub-nav-link"} href="/">
        {t(lang, "leaderboard")}
      </Link>
      <Link className={isActivePath(pathname, "/workbench") ? "hub-nav-link active" : "hub-nav-link"} href="/workbench">
        {t(lang, "workbench")}
      </Link>
      <span className="hub-muted">{t(lang, "models")}</span>
      <div className="hub-model-links hub-desktop-only">
        {topModels.map((item) => (
          <Link
            className={isActivePath(pathname, `/model/${encodeURIComponent(item.model)}`) ? "hub-nav-link active" : "hub-nav-link"}
            key={item.model}
            href={`/model/${encodeURIComponent(item.model)}`}
          >
            {item.model.split("/")[1] ?? item.model}
          </Link>
        ))}
      </div>
      <div className="hub-model-links hub-mobile-only">
        {primaryModels.map((item) => (
          <Link
            className={isActivePath(pathname, `/model/${encodeURIComponent(item.model)}`) ? "hub-nav-link active" : "hub-nav-link"}
            key={`m-${item.model}`}
            href={`/model/${encodeURIComponent(item.model)}`}
          >
            {item.model.split("/")[1] ?? item.model}
          </Link>
        ))}
        {extraModels.length > 0 ? (
          <details className="hub-model-more">
            <summary className={isExtraModelActive ? "hub-model-more-summary active" : "hub-model-more-summary"}>
              {t(lang, "more")}
            </summary>
            <div className="hub-model-more-list">
              {extraModels.map((item) => (
                <Link key={`more-${item.model}`} href={`/model/${encodeURIComponent(item.model)}`}>
                  {item.model}
                </Link>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </nav>
  );
}
