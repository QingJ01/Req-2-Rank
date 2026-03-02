import { z } from "zod";
import { Complexity } from "./types.js";
import { EvidenceChain } from "./submitter-types.js";

const complexitySchema = z.union([
  z.literal("C1"),
  z.literal("C2"),
  z.literal("C3"),
  z.literal("C4"),
  z.literal("mixed")
]);

const providerTypeSchema = z.enum([
  "openai",
  "openai-response",
  "gemini",
  "anthropic",
  "azure-openai",
  "newapi",
  "google",
  "custom"
]);

const modelEndpointBaseSchema = z.object({
  provider: providerTypeSchema,
  model: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().nullable().optional()
});

function withProviderBaseUrlRules<T extends z.ZodRawShape>(schema: z.ZodObject<T>): z.ZodEffects<z.ZodObject<T>> {
  return schema.superRefine((value, context) => {
    if ((value.provider === "azure-openai" || value.provider === "newapi") && !value.baseUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `baseUrl is required for ${value.provider}`,
        path: ["baseUrl"]
      });
    }
  });
}

const modelEndpointSchema = withProviderBaseUrlRules(modelEndpointBaseSchema);
const judgeEndpointSchema = withProviderBaseUrlRules(
  modelEndpointBaseSchema.extend({
    weight: z.number().positive().default(1)
  })
);

export const req2rankConfigSchema = z.object({
  target: modelEndpointSchema,
  systemModel: modelEndpointSchema,
  judges: z.array(judgeEndpointSchema),
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
  evidenceChain?: EvidenceChain;
}

export interface LocalStoreShape {
  runs: RunRecord[];
  calibrations?: CalibrationSnapshot[];
}

export interface CalibrationSnapshot {
  id: string;
  createdAt: string;
  recommendedComplexity: Complexity;
  reason: string;
  averageScore: number;
  sampleSize: number;
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
    enabled: true,
    serverUrl: "https://req2rank.top"
  }
};
