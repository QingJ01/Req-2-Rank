import { appStore } from "../../../../state";
import { publicAuthErrorResponse, toPublicSubmission, validatePublicKey } from "../../shared";

export async function GET(request: Request, context: { params: { id: string } }): Promise<Response> {
  if (!validatePublicKey(request)) {
    return publicAuthErrorResponse();
  }

  const model = decodeURIComponent(context.params.id);
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
