export type RouteState =
  | { page: "overview" }
  | { page: "history"; model?: string }
  | { page: "report"; model: string; runId?: string }
  | { page: "live"; model: string; runId?: string };

export function parseHashRoute(hash: string): RouteState {
  const raw = hash.replace(/^#/, "").trim();
  if (!raw || raw === "/") {
    return { page: "overview" };
  }

  const [pathPart, queryPart] = raw.split("?");
  const parts = pathPart
    .split("/")
    .filter(Boolean)
    .map((item) => decodeURIComponent(item));
  const query = new URLSearchParams(queryPart ?? "");

  if (parts[0] === "history") {
    const model = query.get("model") ?? undefined;
    return { page: "history", model };
  }

  if (parts[0] === "report" && parts[1]) {
    return { page: "report", model: parts[1], runId: parts[2] ?? undefined };
  }

  if (parts[0] === "live" && parts[1]) {
    return { page: "live", model: parts[1], runId: parts[2] ?? undefined };
  }

  return { page: "overview" };
}

export function toHash(route: RouteState): string {
  if (route.page === "overview") {
    return "#/";
  }
  if (route.page === "history") {
    return route.model ? `#/history?model=${encodeURIComponent(route.model)}` : "#/history";
  }
  if (route.page === "report") {
    return route.runId
      ? `#/report/${encodeURIComponent(route.model)}/${encodeURIComponent(route.runId)}`
      : `#/report/${encodeURIComponent(route.model)}`;
  }
  return route.runId
    ? `#/live/${encodeURIComponent(route.model)}/${encodeURIComponent(route.runId)}`
    : `#/live/${encodeURIComponent(route.model)}`;
}
