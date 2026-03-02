import { appStore } from "../../../../state";
import { normalizeModelName } from "../../../../../lib/model-name";
import { publicAuthErrorResponse, toPublicSubmission, validatePublicKey } from "../../shared";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!validatePublicKey(request)) {
    return publicAuthErrorResponse();
  }

  const resolvedParams = await context.params;
  const model = normalizeModelName(decodeURIComponent(resolvedParams.id));
  const submissions = await appStore.listModelSubmissions(model);
  return Response.json(
    {
      ok: true,
      status: 200,
      data: {
        model,
        submissions: submissions.map((item) => toPublicSubmission(item))
      }
    },
    { status: 200 }
  );
}
