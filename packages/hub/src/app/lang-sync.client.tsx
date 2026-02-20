"use client";

import { useEffect } from "react";
import { isLang, pickLang } from "./i18n.js";

const STORAGE_KEY = "hub.lang";

export function LangSync() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const queryLang = url.searchParams.get("lang");
    const storedLang = window.localStorage.getItem(STORAGE_KEY);
    const lang = pickLang(queryLang, storedLang);

    if (isLang(queryLang)) {
      window.localStorage.setItem(STORAGE_KEY, queryLang);
      return;
    }

    if (storedLang !== lang) {
      window.localStorage.setItem(STORAGE_KEY, lang);
    }

    url.searchParams.set("lang", lang);
    const target = `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (target !== current) {
      window.location.replace(target);
    }
  }, []);

  return null;
}
