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

export async function renderModelPage(modelId: string, store: SubmissionStore = appStore): Promise<string> {
  const model = decodeURIComponent(modelId);
  const submissions = await store.listModelSubmissions(model);

  const points = submissions.map((item) => `${item.submittedAt}: ${item.score.toFixed(1)}`).join(" | ");
  const rows = submissions
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.runId)}</td><td>${item.score.toFixed(1)}</td><td>${item.verificationStatus}</td><td>${item.submittedAt}</td></tr>`
    )
    .join("");

  return [
    "<html><head><title>Model Detail</title></head><body>",
    `<h1>Model: ${escapeHtml(model)}</h1>`,
    `<p>Trend: ${escapeHtml(points || "no data")}</p>`,
    "<table><thead><tr><th>Run</th><th>Score</th><th>Status</th><th>Submitted At</th></tr></thead>",
    `<tbody>${rows}</tbody></table>`,
    "</body></html>"
  ].join("");
}
