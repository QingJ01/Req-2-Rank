export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const upstreamUrl = new URL("/api/public/live/stream", url.origin);
  url.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const headers = new Headers();
  const publicApiKey = process.env.R2R_PUBLIC_API_KEY;
  if (publicApiKey) {
    headers.set("x-api-key", publicApiKey);
  }

  const upstream = await fetch(upstreamUrl.toString(), {
    method: "GET",
    headers,
    signal: request.signal,
    cache: "no-store"
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/event-stream; charset=utf-8",
      "cache-control": upstream.headers.get("cache-control") ?? "no-cache, no-transform",
      connection: upstream.headers.get("connection") ?? "keep-alive"
    }
  });
}
