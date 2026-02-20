import { appStore } from "../../../../state";
import { readFile } from "node:fs/promises";

interface LiveProgressSnapshot {
  status: "idle" | "running" | "completed" | "failed";
  updatedAt: string;
  runId?: string;
  model?: string;
  error?: string;
  events: Array<{
    timestamp: string;
    roundIndex: number;
    totalRounds: number;
    phase: "generate" | "execute" | "evaluate" | "score";
    state: "started" | "completed" | "failed";
    message?: string;
  }>;
}

function validatePublicKey(request: Request): boolean {
  const configured = process.env.R2R_PUBLIC_API_KEY;
  if (!configured) {
    return true;
  }
  return request.headers.get("x-api-key") === configured;
}

function formatSseEvent(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

async function readLiveProgress(): Promise<LiveProgressSnapshot | null> {
  const filePath = process.env.R2R_PROGRESS_FILE ?? `${process.cwd()}/.req2rank/live-progress.json`;
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as LiveProgressSnapshot;
    if (!parsed || !Array.isArray(parsed.events)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!validatePublicKey(request)) {
    return Response.json({ ok: false, status: 401, error: { code: "AUTH_ERROR", message: "invalid api key" } }, { status: 401 });
  }

  const url = new URL(request.url);
  const model = url.searchParams.get("model") ?? undefined;
  const limit = url.searchParams.get("limit") ?? "20";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        controller.close();
      };

      const pushUpdate = async () => {
        try {
          const leaderboard = await appStore.listLeaderboard({ limit, offset: 0, sort: "desc" });
          controller.enqueue(encoder.encode(formatSseEvent("leaderboard", leaderboard)));

          if (model) {
            const submissions = await appStore.listModelSubmissions(model);
            controller.enqueue(encoder.encode(formatSseEvent("model-submissions", { model, submissions })));
          }

          const progress = await readLiveProgress();
          controller.enqueue(encoder.encode(formatSseEvent("pipeline-progress", progress)));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          controller.enqueue(encoder.encode(formatSseEvent("error", { message })));
        }
      };

      void pushUpdate();
      const timer = setInterval(() => {
        if (!closed) {
          void pushUpdate();
        }
      }, 2_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(timer);
        close();
      });
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}
