import { AuthError } from "../../../routes";
import { resolveAuthActorFromRequest } from "../route-helpers";
import { appStore, appValidate } from "../../state";

interface CalibrationPayload {
  recommendedComplexity: "C1" | "C2" | "C3" | "C4";
  reason: string;
  averageScore: number;
  sampleSize: number;
  source?: string;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await resolveAuthActorFromRequest(request);
    if (auth.error || !auth.actorId) {
      return Response.json(auth.error, { status: auth.error?.status ?? 401 });
    }
    await appValidate(auth.actorId, auth.token);

    const url = new URL(request.url);
    const rawLimit = url.searchParams.get("limit") ?? "20";
    const limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit <= 0) {
      return Response.json(
        { ok: false, status: 400, error: { code: "VALIDATION_ERROR", message: "invalid limit" } },
        { status: 400 }
      );
    }

    const data = await appStore.listCalibrations(limit);
    return Response.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ ok: false, status: 401, error: { code: error.code, message: error.message } }, { status: 401 });
    }
    return Response.json(
      {
        ok: false,
        status: 400,
        error: { code: "VALIDATION_ERROR", message: error instanceof Error ? error.message : "Invalid request" }
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await resolveAuthActorFromRequest(request);
    if (auth.error || !auth.actorId) {
      return Response.json(auth.error, { status: auth.error?.status ?? 401 });
    }
    await appValidate(auth.actorId, auth.token);

    const payload = (await request.json()) as CalibrationPayload;
    if (!payload?.recommendedComplexity || !payload.reason) {
      return Response.json(
        { ok: false, status: 400, error: { code: "VALIDATION_ERROR", message: "invalid calibration payload" } },
        { status: 400 }
      );
    }

    await appStore.saveCalibration({
      source: payload.source ?? "cli",
      actorId: auth.actorId,
      recommendedComplexity: payload.recommendedComplexity,
      reason: payload.reason,
      averageScore: payload.averageScore,
      sampleSize: payload.sampleSize
    });

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return Response.json({ ok: false, status: 401, error: { code: error.code, message: error.message } }, { status: 401 });
    }
    return Response.json(
      {
        ok: false,
        status: 400,
        error: { code: "VALIDATION_ERROR", message: error instanceof Error ? error.message : "Invalid request" }
      },
      { status: 400 }
    );
  }
}
