import { LeaderboardEntry, LeaderboardQuery, NonceResponse, SubmissionRequest, SubmissionResponse } from "./submitter-types.js";
import { parseLeaderboardQuery } from "./leaderboard-query.js";

export interface HubClient {
  requestNonce(): Promise<NonceResponse>;
  submit(payload: SubmissionRequest): Promise<SubmissionResponse>;
  getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]>;
  submitCalibration(payload: {
    recommendedComplexity: "C1" | "C2" | "C3" | "C4";
    reason: string;
    averageScore: number;
    sampleSize: number;
    source?: string;
  }): Promise<{ ok: boolean }>;
}

export interface HubClientOptions {
  serverUrl?: string;
  token?: string;
}

class PlaceholderHubClient implements HubClient {
  async requestNonce(): Promise<NonceResponse> {
    return {
      nonce: "placeholder-nonce",
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    };
  }

  async submit(payload: SubmissionRequest): Promise<SubmissionResponse> {
    return {
      status: "pending",
      message: `Submit pending for ${payload.runId}`
    };
  }

  async getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const normalizedQuery = parseLeaderboardQuery(query);
    const { limit, offset, sort } = normalizedQuery;

    const base = Array.from({ length: 5 }).map((_, index) => ({
      rank: index + 1,
      model: `placeholder/model-${index + 1}`,
      score: 95 - index
    }));

    const ordered = sort === "asc" ? base.slice().reverse() : base;
    return ordered.slice(offset, offset + limit).map((entry, index) => ({
      ...entry,
      rank: offset + index + 1
    }));
  }

  async submitCalibration(): Promise<{ ok: boolean }> {
    return { ok: false };
  }
}

class HttpHubClient implements HubClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(serverUrl: string, token: string) {
    this.baseUrl = serverUrl.replace(/\/+$/, "");
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      Authorization: `Bearer ${this.token}`
    };
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init?.headers as Record<string, string> | undefined)
      }
    });

    if (!response.ok) {
      throw new Error(`Hub request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async requestNonce(): Promise<NonceResponse> {
    return this.requestJson<NonceResponse>("/api/nonce", {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  async submit(payload: SubmissionRequest): Promise<SubmissionResponse> {
    return this.requestJson<SubmissionResponse>("/api/submit", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const normalizedQuery = parseLeaderboardQuery(query);
    const params = new URLSearchParams({
      limit: String(normalizedQuery.limit),
      offset: String(normalizedQuery.offset),
      sort: normalizedQuery.sort
    });
    if (normalizedQuery.complexity) {
      params.set("complexity", normalizedQuery.complexity);
    }
    if (normalizedQuery.dimension) {
      params.set("dimension", normalizedQuery.dimension);
    }

    return this.requestJson<LeaderboardEntry[]>(`/api/leaderboard?${params.toString()}`, {
      method: "GET"
    });
  }

  async submitCalibration(payload: {
    recommendedComplexity: "C1" | "C2" | "C3" | "C4";
    reason: string;
    averageScore: number;
    sampleSize: number;
    source?: string;
  }): Promise<{ ok: boolean }> {
    return this.requestJson<{ ok: boolean }>("/api/calibration", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
}

export function createHubClient(options: HubClientOptions = {}): HubClient {
  const serverUrl = options.serverUrl ?? process.env.R2R_HUB_SERVER_URL;
  const token = options.token ?? process.env.R2R_HUB_TOKEN;

  if (serverUrl && token) {
    return new HttpHubClient(serverUrl, token);
  }

  return new PlaceholderHubClient();
}
