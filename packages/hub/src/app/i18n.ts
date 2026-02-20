export type Lang = "zh" | "en";

export function isLang(value: string | null | undefined): value is Lang {
  return value === "zh" || value === "en";
}

export function resolveLang(input?: string | null): Lang {
  return isLang(input) ? input : "zh";
}

export function pickLang(queryLang?: string | null, storedLang?: string | null): Lang {
  if (isLang(queryLang)) {
    return queryLang;
  }
  if (isLang(storedLang)) {
    return storedLang;
  }
  return "zh";
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

export function localizePath(path: string, lang: Lang): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}lang=${lang}`;
}
