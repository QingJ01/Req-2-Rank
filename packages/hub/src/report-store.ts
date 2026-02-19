export interface CommunityReport {
  id: string;
  runId: string;
  reason: string;
  details?: string;
  createdAt: string;
  status: "open" | "resolved";
}

const reports: CommunityReport[] = [];

export function submitCommunityReport(input: { runId: string; reason: string; details?: string }): CommunityReport {
  const report: CommunityReport = {
    id: `report-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    runId: input.runId,
    reason: input.reason,
    details: input.details,
    createdAt: new Date().toISOString(),
    status: "open"
  };
  reports.unshift(report);
  return report;
}

export function listCommunityReports(): CommunityReport[] {
  return reports.slice();
}

export function resolveCommunityReport(id: string): CommunityReport | undefined {
  const report = reports.find((item) => item.id === id);
  if (!report) {
    return undefined;
  }
  report.status = "resolved";
  return report;
}
