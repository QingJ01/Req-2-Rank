import { appStore } from "../state.js";
import { SubmissionStore } from "../../routes.js";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function renderLeaderboardPage(store: SubmissionStore = appStore): Promise<string> {
  const entries = await store.listLeaderboard({ limit: 20, offset: 0, sort: "desc" });
  const rows = entries
    .map(
      (entry) =>
        `<tr><td>${entry.rank}</td><td>${escapeHtml(entry.model)}</td><td>${entry.score.toFixed(1)}</td></tr>`
    )
    .join("");

  return [
    "<html><head><title>Req2Rank Leaderboard</title></head><body>",
    "<h1>Req2Rank Leaderboard</h1>",
    "<table><thead><tr><th>Rank</th><th>Model</th><th>Score</th></tr></thead>",
    `<tbody>${rows}</tbody></table>`,
    "</body></html>"
  ].join("");
}
