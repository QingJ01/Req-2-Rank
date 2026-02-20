"use client";

import { useEffect } from "react";
import { HUB_LANG_EVENT, isLang } from "./i18n";

const STORAGE_KEY = "hub.lang";
const COOKIE_KEY = "hub.lang";

export function LangSync() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncLangCookie = () => {
      const storedLang = window.localStorage.getItem(STORAGE_KEY);
      if (isLang(storedLang)) {
        document.cookie = `${COOKIE_KEY}=${storedLang};path=/;max-age=31536000;SameSite=Lax`;
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        syncLangCookie();
      }
    };

    syncLangCookie();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(HUB_LANG_EVENT, syncLangCookie);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(HUB_LANG_EVENT, syncLangCookie);
    };
  }, []);

  return null;
}
