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

export async function renderSubmissionPage(runId: string, store: SubmissionStore = appStore): Promise<string> {
  const detail = await store.getSubmission(runId);
  if (!detail) {
    return "<html><body><h1>Submission Not Found</h1></body></html>";
  }

  return [
    "<html><head><title>Submission Detail</title></head><body>",
    `<h1>Submission: ${escapeHtml(detail.runId)}</h1>`,
    `<p>Model: ${escapeHtml(detail.model)}</p>`,
    `<p>Score: ${detail.score.toFixed(1)}</p>`,
    `<p>Status: ${detail.verificationStatus}</p>`,
    `<p>Submitted At: ${detail.submittedAt}</p>`,
    "</body></html>"
  ].join("");
}
