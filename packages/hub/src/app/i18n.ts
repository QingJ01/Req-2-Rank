export type Lang = "zh" | "en";
export const HUB_LANG_EVENT = "hub:lang-change";

export function isLang(value: string | null | undefined): value is Lang {
  return value === "zh" || value === "en";
}

export function resolveLang(input?: string | null): Lang {
  return isLang(input) ? input : "zh";
}

export function pickLang(storedLang?: string | null): Lang {
  return isLang(storedLang) ? storedLang : "zh";
}

function normalizePath(path: string): string {
  if (path === "/") {
    return "/";
  }
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function isActivePath(currentPath: string, targetPath: string): boolean {
  return normalizePath(currentPath) === normalizePath(targetPath);
}
