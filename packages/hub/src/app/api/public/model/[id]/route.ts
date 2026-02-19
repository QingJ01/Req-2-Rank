import { appStore } from "../../../../state.js";

function validatePublicKey(request: Request): boolean {
  const configured = process.env.R2R_PUBLIC_API_KEY;
  if (!configured) {
    return true;
  }
  return request.headers.get("x-api-key") === configured;
}

export async function GET(request: Request, context: { params: { id: string } }): Promise<Response> {
  if (!validatePublicKey(request)) {
    return Response.json({ ok: false, status: 401, error: { code: "AUTH_ERROR", message: "invalid api key" } }, { status: 401 });
  }

  const model = decodeURIComponent(context.params.id);
  const submissions = await appStore.listModelSubmissions(model);
  return Response.json(
    {
      ok: true,
      status: 200,
      data: {
        model,
        submissions
      }
    },
    { status: 200 }
  );
}
