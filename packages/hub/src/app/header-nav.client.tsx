"use client";

import { useEffect, useMemo, useState } from "react";
import { isActivePath, pickLang, type Lang } from "./i18n.js";

type TopModel = {
  model: string;
};

type HeaderNavProps = {
  topModels: TopModel[];
};

function navPath(path: string, lang: Lang): string {
  return `${path}?lang=${lang}`;
}

export function HeaderNav({ topModels }: HeaderNavProps) {
  const [pathname, setPathname] = useState("/");
  const [queryString, setQueryString] = useState("");
  const [storedLang, setStoredLang] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setPathname(window.location.pathname || "/");
    setQueryString(window.location.search.replace(/^\?/, ""));
    setStoredLang(window.localStorage.getItem("hub.lang"));
  }, []);

  const searchParams = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const lang = pickLang(searchParams.get("lang"), storedLang);
  const isEn = lang === "en";
  const primaryModels = topModels.slice(0, 2);
  const extraModels = topModels.slice(2);
  const isExtraModelActive = extraModels.some((item) => isActivePath(pathname, `/model/${encodeURIComponent(item.model)}`));

  const switchHref = (nextLang: Lang): string => {
    const query = new URLSearchParams(searchParams.toString());
    query.set("lang", nextLang);
    const serialized = query.toString();
    return serialized ? `${pathname}?${serialized}` : pathname;
  };

  return (
    <nav className="hub-nav">
      <a className={isActivePath(pathname, "/") ? "hub-nav-link active" : "hub-nav-link"} href={navPath("/", lang)}>
        {isEn ? "Leaderboard" : "排行榜"}
      </a>
      <a className={isActivePath(pathname, "/workbench") ? "hub-nav-link active" : "hub-nav-link"} href={navPath("/workbench", lang)}>
        {isEn ? "Workbench" : "工作台"}
      </a>
      <span className="hub-muted">{isEn ? "Models" : "模型"}</span>
      <div className="hub-model-links hub-desktop-only">
        {topModels.map((item) => (
          <a
            className={isActivePath(pathname, `/model/${encodeURIComponent(item.model)}`) ? "hub-nav-link active" : "hub-nav-link"}
            key={item.model}
            href={navPath(`/model/${encodeURIComponent(item.model)}`, lang)}
          >
            {item.model.split("/")[1] ?? item.model}
          </a>
        ))}
      </div>
      <div className="hub-model-links hub-mobile-only">
        {primaryModels.map((item) => (
          <a
            className={isActivePath(pathname, `/model/${encodeURIComponent(item.model)}`) ? "hub-nav-link active" : "hub-nav-link"}
            key={`m-${item.model}`}
            href={navPath(`/model/${encodeURIComponent(item.model)}`, lang)}
          >
            {item.model.split("/")[1] ?? item.model}
          </a>
        ))}
        {extraModels.length > 0 ? (
          <details className="hub-model-more">
            <summary className={isExtraModelActive ? "hub-model-more-summary active" : "hub-model-more-summary"}>
              {isEn ? "More" : "更多"}
            </summary>
            <div className="hub-model-more-list">
              {extraModels.map((item) => (
                <a key={`more-${item.model}`} href={navPath(`/model/${encodeURIComponent(item.model)}`, lang)}>
                  {item.model}
                </a>
              ))}
            </div>
          </details>
        ) : null}
      </div>
      <span className="hub-muted">{isEn ? "Language" : "语言"}</span>
      <a
        className={lang === "zh" ? "hub-nav-lang active" : "hub-nav-lang"}
        href={switchHref("zh")}
        onClick={() => window.localStorage.setItem("hub.lang", "zh")}
      >
        中文
      </a>
      <a
        className={lang === "en" ? "hub-nav-lang active" : "hub-nav-lang"}
        href={switchHref("en")}
        onClick={() => window.localStorage.setItem("hub.lang", "en")}
      >
        EN
      </a>
    </nav>
  );
}
