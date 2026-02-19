import { z } from "zod";
import { Complexity } from "./types.js";

const complexitySchema = z.union([
  z.literal("C1"),
  z.literal("C2"),
  z.literal("C3"),
  z.literal("C4"),
  z.literal("mixed")
]);

export const req2rankConfigSchema = z.object({
  target: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    apiKey: z.string().optional(),
    baseUrl: z.string().url().nullable().optional()
  }),
  systemModel: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    apiKey: z.string().optional()
  }),
  judges: z.array(
    z.object({
      provider: z.string().min(1),
      model: z.string().min(1),
      apiKey: z.string().optional(),
      weight: z.number().positive().default(1)
    })
  ),
  test: z.object({
    complexity: complexitySchema,
    rounds: z.number().int().positive(),
    concurrency: z.number().int().positive()
  }),
  hub: z
    .object({
      enabled: z.boolean().default(false),
      serverUrl: z.string().url().optional(),
      token: z.string().optional()
    })
    .optional()
});

export type Req2RankConfig = z.infer<typeof req2rankConfigSchema>;

export interface RunRecord {
  id: string;
  createdAt: string;
  targetProvider: string;
  targetModel: string;
  complexity: Complexity | "mixed";
  rounds: number;
  requirementTitle: string;
  overallScore: number;
  dimensionScores: Record<string, number>;
  ci95: [number, number];
  agreementLevel: "high" | "moderate" | "low";
  ijaScore?: number;
}

export interface LocalStoreShape {
  runs: RunRecord[];
}

export const defaultConfig: Req2RankConfig = {
  target: {
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: ""
  },
  systemModel: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    apiKey: ""
  },
  judges: [
    {
      provider: "openai",
      model: "gpt-4o",
      apiKey: "",
      weight: 1
    }
  ],
  test: {
    complexity: "mixed",
    rounds: 1,
    concurrency: 1
  },
  hub: {
    enabled: false
  }
};
