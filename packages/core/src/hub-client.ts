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

class UnconfiguredHubClient implements HubClient {
  private missingConfigError(): Error {
    return new Error("Hub is not configured. Set hub.enabled=true and provide serverUrl/token.");
  }

  async requestNonce(): Promise<NonceResponse> {
    throw this.missingConfigError();
  }

  async submit(_payload: SubmissionRequest): Promise<SubmissionResponse> {
    throw this.missingConfigError();
  }

  async getLeaderboard(_query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    throw this.missingConfigError();
  }

  async submitCalibration(): Promise<{ ok: boolean }> {
    throw this.missingConfigError();
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
    return this.requestJson<NonceResponse>("/api/nonces", {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  async submit(payload: SubmissionRequest): Promise<SubmissionResponse> {
    return this.requestJson<SubmissionResponse>("/api/submissions", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const normalizedQuery = parseLeaderboardQuery(query);
    const complexitySegment = encodeURIComponent(normalizedQuery.complexity ?? "all");
    const dimensionSegment = normalizedQuery.dimension ? `/${encodeURIComponent(normalizedQuery.dimension)}` : "";
    const params = new URLSearchParams({
      limit: String(normalizedQuery.limit),
      offset: String(normalizedQuery.offset),
      sort: normalizedQuery.sort
    });

    return this.requestJson<LeaderboardEntry[]>(`/api/leaderboard/${complexitySegment}${dimensionSegment}?${params.toString()}`, {
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

  return new UnconfiguredHubClient();
}
