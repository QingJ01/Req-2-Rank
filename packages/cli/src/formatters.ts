import { LeaderboardEntry, RunRecord } from "@req2rank/core";

export function formatReportText(run: RunRecord): string {
  const dimensions = Object.entries(run.dimensionScores)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return [
    `Target: ${run.targetProvider}/${run.targetModel}`,
    `Complexity: ${run.complexity}`,
    `Rounds: ${run.rounds}`,
    `Overall score: ${run.overallScore}`,
    `CI95: [${run.ci95[0]}, ${run.ci95[1]}]`,
    `Agreement: ${run.agreementLevel}`,
    `IJA: ${run.ijaScore ?? "n/a"}`,
    dimensions
  ].join("\n");
}

export function formatReportTextCompact(run: RunRecord): string {
  return [
    "Compact Report",
    `Run: ${run.id}`,
    `Target: ${run.targetProvider}/${run.targetModel}`,
    `Overall score: ${run.overallScore}`
  ].join("\n");
}

export function formatReportMarkdown(run: RunRecord): string {
  const dimensionRows = Object.entries(run.dimensionScores)
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");
  const timelineRows = run.evidenceChain?.timeline
    ?.map((item) => `| ${item.phase} | ${item.startedAt} | ${item.completedAt} | ${item.model} |`)
    .join("\n");
  const sample = run.evidenceChain?.samples?.[0];

  return [
    "# Req2Rank Report",
    "",
    "## Metadata",
    `- Run ID: ${run.id}`,
    `- Created At: ${run.createdAt}`,
    `- Target: ${run.targetProvider}/${run.targetModel}`,
    `- Complexity: ${run.complexity}`,
    `- Rounds: ${run.rounds}`,
    `- Overall Score: ${run.overallScore}`,
    `- CI95: [${run.ci95[0]}, ${run.ci95[1]}]`,
    `- Agreement: ${run.agreementLevel}`,
    `- IJA: ${run.ijaScore ?? "n/a"}`,
    "",
    "## Dimension Scores",
    "| Dimension | Score |",
    "| --- | ---: |",
    dimensionRows,
    timelineRows
      ? [
          "",
          "## Timeline",
          "| Phase | Started At | Completed At | Model |",
          "| --- | --- | --- | --- |",
          timelineRows
        ].join("\n")
      : "",
    sample
      ? [
          "",
          "## Sample Requirement",
          "```json",
          sample.requirement,
          "```",
          "",
          "## Sample Code",
          "```",
          sample.codeSubmission,
          "```"
        ].join("\n")
      : ""
  ].join("\n");
}

export function formatReportMarkdownCompact(run: RunRecord): string {
  const timelineRows = run.evidenceChain?.timeline
    ?.map((item) => `| ${item.phase} | ${item.startedAt} | ${item.completedAt} | ${item.model} |`)
    .join("\n");
  const sample = run.evidenceChain?.samples?.[0];

  return [
    "# Compact Report",
    "",
    `- Run ID: ${run.id}`,
    `- Target: ${run.targetProvider}/${run.targetModel}`,
    `- Overall Score: ${run.overallScore}`,
    timelineRows
      ? [
          "",
          "## Timeline",
          "| Phase | Started At | Completed At | Model |",
          "| --- | --- | --- | --- |",
          timelineRows
        ].join("\n")
      : "",
    sample
      ? [
          "",
          "## Sample Requirement",
          "```json",
          sample.requirement,
          "```",
          "",
          "## Sample Code",
          "```",
          sample.codeSubmission,
          "```"
        ].join("\n")
      : ""
  ].join("\n");
}

export function formatReportJson(run: RunRecord): string {
  return JSON.stringify(
    {
      runId: run.id,
      createdAt: run.createdAt,
      target: `${run.targetProvider}/${run.targetModel}`,
      complexity: run.complexity,
      rounds: run.rounds,
      overallScore: run.overallScore,
      ci95: run.ci95,
      agreementLevel: run.agreementLevel,
      ijaScore: run.ijaScore,
      dimensionScores: run.dimensionScores
    },
    null,
    2
  );
}

export function formatRunSummaryText(run: RunRecord): string {
  const dimensions = Object.entries(run.dimensionScores)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const timeline = run.evidenceChain?.timeline
    ?.map((item) => `${item.phase} ${item.startedAt} -> ${item.completedAt} (${item.model})`)
    .join("\n");
  const sample = run.evidenceChain?.samples?.[0];

  return [
    `Run completed: ${run.id}`,
    `Target: ${run.targetProvider}/${run.targetModel}`,
    `Complexity: ${run.complexity}`,
    `Rounds: ${run.rounds}`,
    `Overall score: ${run.overallScore}`,
    `CI95: [${run.ci95[0]}, ${run.ci95[1]}]`,
    `Agreement: ${run.agreementLevel}`,
    `IJA: ${run.ijaScore ?? "n/a"}`,
    dimensions,
    timeline ? ["", "Timeline", timeline].join("\n") : "",
    sample
      ? ["", "Sample Requirement", sample.requirement, "", "Sample Code", sample.codeSubmission].join("\n")
      : ""
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function formatHistoryText(runs: RunRecord[]): string {
  const lines = [`Run count: ${runs.length}`];
  for (const run of runs.slice(0, 5)) {
    lines.push(`${run.id} | ${run.complexity} | ${run.overallScore}`);
  }
  return lines.join("\n");
}

export function formatHistoryJson(runs: RunRecord[]): string {
  return JSON.stringify(runs, null, 2);
}

export function formatLeaderboardText(entries: LeaderboardEntry[]): string {
  return entries
    .map((entry) => {
      const ci = entry.ci95 ? ` [${entry.ci95[0]}, ${entry.ci95[1]}]` : "";
      const status = entry.verificationStatus ? ` (${entry.verificationStatus})` : "";
      return `${entry.rank}. ${entry.model} - ${entry.score}${ci}${status}`;
    })
    .join("\n");
}

export function formatLeaderboardTable(entries: LeaderboardEntry[]): string {
  const rows = entries.map(
    (entry) =>
      `${entry.rank} | ${entry.model} | ${entry.score} | ${entry.ci95 ? `[${entry.ci95[0]}, ${entry.ci95[1]}]` : "-"} | ${entry.verificationStatus ?? "-"}`
  );
  return ["Rank | Model | Score | CI95 | Verification", ...rows].join("\n");
}

export function formatLeaderboardJson(entries: LeaderboardEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
