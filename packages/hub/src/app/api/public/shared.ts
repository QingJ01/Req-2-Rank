import type { SubmissionDetail } from "../../../routes";

export interface PublicSubmissionDetail {
  runId: string;
  model: string;
  complexity: SubmissionDetail["complexity"];
  score: number;
  ci95: [number, number];
  agreementLevel: SubmissionDetail["agreementLevel"];
  dimensionScores: Record<string, number>;
  submittedAt: string;
  verificationStatus: SubmissionDetail["verificationStatus"];
  evidenceChain?: SubmissionDetail["evidenceChain"];
}

function allowAnonymousPublicAccess(): boolean {
  if (process.env.R2R_PUBLIC_API_OPEN === "true") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

export function validatePublicKey(request: Request): boolean {
  const configured = process.env.R2R_PUBLIC_API_KEY;
  if (configured) {
    return request.headers.get("x-api-key") === configured;
  }
  return allowAnonymousPublicAccess();
}

export function publicAuthErrorResponse(): Response {
  return Response.json({ ok: false, status: 401, error: { code: "AUTH_ERROR", message: "invalid api key" } }, { status: 401 });
}

function includePublicEvidence(): boolean {
  return process.env.R2R_PUBLIC_INCLUDE_EVIDENCE === "true";
}

export function toPublicSubmission(submission: SubmissionDetail): PublicSubmissionDetail {
  if (includePublicEvidence()) {
    return { ...submission };
  }

  return {
    runId: submission.runId,
    model: submission.model,
    complexity: submission.complexity,
    score: submission.score,
    ci95: submission.ci95,
    agreementLevel: submission.agreementLevel,
    dimensionScores: submission.dimensionScores,
    submittedAt: submission.submittedAt,
    verificationStatus: submission.verificationStatus
  };
}
