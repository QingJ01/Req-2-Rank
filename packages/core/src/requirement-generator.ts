import { Complexity, ProjectRequirement } from "./types.js";
import { LLMProvider } from "./providers/base.js";
import { DOMAIN_NAMES, DOMAIN_TAXONOMY } from "./domain-taxonomy.js";

export interface RequirementSeed {
  id: string;
  template: string;
  skills: string[];
  complexity: Complexity;
  slots: Record<string, string[]>;
}

export interface GenerationInput {
  skills: string[];
  complexity: Complexity;
  domain: string;
  scenario: string;
  techStack: string[];
  extraConstraints?: string[];
  seed?: string;
}

export interface GenerationModelConfig {
  provider: LLMProvider;
  model: string;
}

const DEFAULT_SEEDS: RequirementSeed[] = [
  {
    id: "seed-cli-transformer",
    template: "Build a {artifact} tool for {scenario} with {constraint}",
    skills: ["data-processing", "error-handling"],
    complexity: "C1",
    slots: {
      artifact: ["CLI", "pipeline", "parser"],
      scenario: ["CSV cleaning", "log normalization", "JSON validation"],
      constraint: ["strict input validation", "retry-safe processing", "clear error summaries"]
    }
  },
  {
    id: "seed-api-workflow",
    template: "Design a {scope} API for {domainObject} including {constraint}",
    skills: ["api-design", "testing", "error-handling"],
    complexity: "C2",
    slots: {
      scope: ["REST", "resource workflow", "state transition"],
      domainObject: ["orders", "tickets", "subscriptions"],
      constraint: ["idempotency", "rate-limited retries", "role-based permissions"]
    }
  },
  {
    id: "seed-service-orchestration",
    template: "Implement a {artifact} orchestration for {domain} with {constraint}",
    skills: ["distributed-systems", "api-design", "observability"],
    complexity: "C3",
    slots: {
      artifact: ["multi-service workflow", "event-driven coordinator", "saga executor"],
      constraint: ["exactly-once semantics", "compensating actions", "partial-failure recovery"]
    }
  },
  {
    id: "seed-platform-governance",
    template: "Design a {artifact} platform for {domain} requiring {constraint}",
    skills: ["security", "governance", "testing"],
    complexity: "C4",
    slots: {
      artifact: ["tenant-isolated runtime", "compliance-grade audit system", "policy-driven execution mesh"],
      constraint: ["formal rollback strategy", "cross-region consistency", "regulated data retention controls"]
    }
  },
  {
    id: "seed-ai-evaluation-suite",
    template: "Build a {artifact} for {scenario} with {constraint}",
    skills: ["evaluation", "data-processing", "error-handling"],
    complexity: "C3",
    slots: {
      artifact: ["benchmark harness", "evaluation aggregator", "trace replay runner"],
      scenario: ["model ranking", "regression gating", "failure clustering"],
      constraint: ["deterministic replay", "parallel isolation", "reproducible scoring"]
    }
  }
];

class SeededRng {
  private state: number;

  constructor(seed: string) {
    this.state = hashSeed(seed);
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickOne<T>(items: T[], rng: SeededRng): T {
  if (items.length === 0) {
    throw new Error("Cannot pick from empty list.");
  }
  const index = Math.floor(rng.next() * items.length);
  return items[index];
}

function chooseSeed(input: GenerationInput, seeds: RequirementSeed[], rng: SeededRng): RequirementSeed {
  const candidates = seeds.filter(
    (seed) => seed.complexity === input.complexity && seed.skills.some((skill) => input.skills.includes(skill))
  );

  if (candidates.length > 0) {
    return pickOne(candidates, rng);
  }

  return pickOne(seeds.filter((seed) => seed.complexity === input.complexity), rng);
}

function fillTemplate(seed: RequirementSeed, input: GenerationInput, rng: SeededRng): { text: string; mutationLog: string[] } {
  const mutationLog: string[] = [];
  let text = seed.template;

  for (const [slotKey, slotValues] of Object.entries(seed.slots)) {
    const value = pickOne(slotValues, rng);
    text = text.replace(`{${slotKey}}`, value);
    mutationLog.push(`slot:${slotKey}=${value}`);
  }

  text = text.replace("{domain}", input.domain).replace("{scenario}", input.scenario);
  mutationLog.push(`domain:${input.domain}`);
  mutationLog.push(`scenario:${input.scenario}`);

  if (input.extraConstraints && input.extraConstraints.length > 0) {
    mutationLog.push(`extra-constraints:${input.extraConstraints.join("|")}`);
  }

  return { text, mutationLog };
}

interface StructuredRequirementDraft {
  title?: unknown;
  description?: unknown;
  functionalRequirements?: unknown;
  constraints?: unknown;
  expectedDeliverables?: unknown;
  exampleIO?: unknown;
  evaluationGuidance?: unknown;
  selfReviewPassed?: unknown;
}

function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // continue with fence fallback
  }

  const jsonFence = raw.match(/```json\n([\s\S]*?)```/i);
  if (jsonFence) {
    try {
      const parsed = JSON.parse(jsonFence[1]) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function normalizePriority(value: unknown): "must" | "should" | "nice-to-have" {
  if (value === "must" || value === "should" || value === "nice-to-have") {
    return value;
  }

  return "must";
}

function buildDefaultFunctionalRequirements(description: string): ProjectRequirement["functionalRequirements"] {
  return [
    {
      id: "FR-1",
      description: `Implement the core flow: ${description}`,
      acceptanceCriteria: "Core flow behaves as specified for valid input.",
      priority: "must"
    },
    {
      id: "FR-2",
      description: "Handle at least one edge case with deterministic behavior.",
      acceptanceCriteria: "Edge-case path is explicitly handled and testable.",
      priority: "must"
    }
  ];
}

function toProjectRequirementDraft(
  parsed: StructuredRequirementDraft,
  fallbackDescription: string
): Pick<
  ProjectRequirement,
  | "title"
  | "description"
  | "functionalRequirements"
  | "constraints"
  | "expectedDeliverables"
  | "exampleIO"
  | "evaluationGuidance"
  | "selfReviewPassed"
> {
  const functionalRequirements: ProjectRequirement["functionalRequirements"] = Array.isArray(parsed.functionalRequirements)
    ? parsed.functionalRequirements
        .filter((item) => item && typeof item === "object")
        .map((item, index) => {
          const record = item as Record<string, unknown>;
          return {
            id: typeof record.id === "string" && record.id.length > 0 ? record.id : `FR-${index + 1}`,
            description:
              typeof record.description === "string" && record.description.length > 0
                ? record.description
                : "Implement specified feature",
            acceptanceCriteria:
              typeof record.acceptanceCriteria === "string" && record.acceptanceCriteria.length > 0
                ? record.acceptanceCriteria
                : "Behavior is verifiable with pass/fail criteria",
            priority: normalizePriority(record.priority)
          };
        })
    : [];

  const normalizedFunctionalRequirements =
    functionalRequirements.length >= 2
      ? functionalRequirements
      : [...functionalRequirements, ...buildDefaultFunctionalRequirements(fallbackDescription)].slice(0, 2);

  const evaluationGuidanceInput =
    parsed.evaluationGuidance && typeof parsed.evaluationGuidance === "object"
      ? (parsed.evaluationGuidance as Record<string, unknown>)
      : undefined;

  return {
    title: typeof parsed.title === "string" && parsed.title.length > 0 ? parsed.title : "Generated Requirement",
    description:
      typeof parsed.description === "string" && parsed.description.length > 0 ? parsed.description : fallbackDescription,
    functionalRequirements: normalizedFunctionalRequirements,
    constraints: Array.isArray(parsed.constraints) ? parsed.constraints.filter((item): item is string => typeof item === "string") : [],
    expectedDeliverables: Array.isArray(parsed.expectedDeliverables)
      ? parsed.expectedDeliverables.filter((item): item is string => typeof item === "string")
      : ["source code", "tests"],
    exampleIO: Array.isArray(parsed.exampleIO)
      ? parsed.exampleIO
          .filter((item) => item && typeof item === "object")
          .map((item) => {
            const record = item as Record<string, unknown>;
            return {
              input: typeof record.input === "string" ? record.input : "",
              expectedOutput: typeof record.expectedOutput === "string" ? record.expectedOutput : ""
            };
          })
          .filter((item) => item.input.length > 0 && item.expectedOutput.length > 0)
      : undefined,
    evaluationGuidance: {
      keyDifferentiators: Array.isArray(evaluationGuidanceInput?.keyDifferentiators)
        ? evaluationGuidanceInput.keyDifferentiators.filter((item): item is string => typeof item === "string")
        : ["requirement coverage", "clarity", "edge-case handling"],
      commonPitfalls: Array.isArray(evaluationGuidanceInput?.commonPitfalls)
        ? evaluationGuidanceInput.commonPitfalls.filter((item): item is string => typeof item === "string")
        : ["missing validation", "incomplete acceptance criteria"],
      edgeCases: Array.isArray(evaluationGuidanceInput?.edgeCases)
        ? evaluationGuidanceInput.edgeCases.filter((item): item is string => typeof item === "string")
        : ["empty input", "invalid parameter"]
    },
    selfReviewPassed: Boolean(parsed.selfReviewPassed)
  };
}

function buildStageOnePrompt(input: GenerationInput, generatedSeedText: string): string {
  return [
    "You are a senior software PM. Draft a project requirement document.",
    "", 
    `Skills: ${input.skills.join(", ")}`,
    `Complexity: ${input.complexity}`,
    `Domain: ${input.domain}`,
    `Scenario: ${input.scenario}`,
    `Tech stack: ${input.techStack.join(", ")}`,
    `Seed requirement skeleton: ${generatedSeedText}`,
    input.extraConstraints && input.extraConstraints.length > 0
      ? `Additional constraints: ${input.extraConstraints.join("; ")}`
      : "Additional constraints: none",
    "",
    "Requirements:",
    "1. Produce concrete, testable functional requirements.",
    "2. Include at least one explicit edge case.",
    "3. Keep scope aligned with the complexity.",
    "4. Include delivery expectations (code/tests/docs)."
  ].join("\n");
}

function buildStageTwoPrompt(draftRequirement: string, complexity: Complexity): string {
  return [
    "You are a QA reviewer. Audit and improve this requirement draft.",
    "", 
    "Checklist:",
    "1. Remove ambiguity.",
    "2. Ensure each requirement has pass/fail acceptance criteria.",
    "3. Confirm technical feasibility.",
    `4. Keep difficulty at complexity ${complexity}.`,
    "5. Resolve conflicting constraints.",
    "", 
    "Draft:",
    draftRequirement
  ].join("\n");
}

function buildStageThreePrompt(reviewedRequirement: string): string {
  return [
    "Convert the reviewed requirement into strict JSON.",
    "Return only JSON object with keys:",
    "title, description, functionalRequirements[], constraints[], expectedDeliverables[], exampleIO[{input,expectedOutput}], evaluationGuidance{keyDifferentiators[], commonPitfalls[], edgeCases[]}, selfReviewPassed",
    "Each functional requirement must include id, description, acceptanceCriteria, priority.",
    "", 
    "Reviewed requirement:",
    reviewedRequirement
  ].join("\n");
}

export class RequirementGenerator {
  private readonly seeds: RequirementSeed[];

  constructor(seeds: RequirementSeed[] = DEFAULT_SEEDS) {
    this.seeds = seeds;
  }

  async generate(input: GenerationInput, modelConfig: GenerationModelConfig): Promise<ProjectRequirement> {
    const seedValue = input.seed ?? `${input.domain}:${input.scenario}:${Date.now()}`;
    const rng = new SeededRng(seedValue);
    const selectedSeed = chooseSeed(input, this.seeds, rng);
    const shouldSampleTaxonomy =
      input.domain.trim().toLowerCase() === "generic" || input.scenario.trim().toLowerCase() === "pipeline-eval";
    const sampledDomain = shouldSampleTaxonomy ? pickOne(DOMAIN_NAMES, rng) : input.domain;
    const sampledScenario =
      shouldSampleTaxonomy && sampledDomain in DOMAIN_TAXONOMY
        ? pickOne([...DOMAIN_TAXONOMY[sampledDomain as keyof typeof DOMAIN_TAXONOMY]], rng)
        : input.scenario;

    const normalizedInput: GenerationInput = {
      ...input,
      domain: sampledDomain,
      scenario: sampledScenario
    };

    const generated = fillTemplate(selectedSeed, normalizedInput, rng);

    const stageOne = await modelConfig.provider.chat({
      model: modelConfig.model,
      temperature: 0.4,
      maxTokens: 2_048,
      messages: [
        {
          role: "system",
          content: "You produce high-quality, unambiguous software project requirements."
        },
        {
          role: "user",
          content: buildStageOnePrompt(normalizedInput, generated.text)
        }
      ]
    });

    const stageTwo = await modelConfig.provider.chat({
      model: modelConfig.model,
      temperature: 0.2,
      maxTokens: 2_048,
      messages: [
        {
          role: "system",
          content: "You are a strict QA reviewer for software requirements."
        },
        {
          role: "user",
          content: buildStageTwoPrompt(stageOne.content, normalizedInput.complexity)
        }
      ]
    });

    const stageThree = await modelConfig.provider.chat({
      model: modelConfig.model,
      temperature: 0,
      maxTokens: 2_048,
      responseFormat: "json",
      messages: [
        {
          role: "system",
          content: "Return strictly valid JSON with no markdown."
        },
        {
          role: "user",
          content: buildStageThreePrompt(stageTwo.content)
        }
      ]
    });

    const parsed = parseJsonObject(stageThree.content);
    const normalized = toProjectRequirementDraft(parsed ?? {}, stageTwo.content);

    const requirementId = `req-${Math.floor(rng.next() * 1_000_000)}`;

    const constraints = [
      `Complexity constrained to ${input.complexity}`,
      ...normalized.constraints
    ];

    if (input.extraConstraints) {
      constraints.push(...input.extraConstraints);
    }

    return {
      id: requirementId,
      version: "1.0",
      title: normalized.title,
      description: normalized.description,
      functionalRequirements: normalized.functionalRequirements,
      constraints,
      expectedDeliverables: normalized.expectedDeliverables,
      exampleIO: normalized.exampleIO,
      metadata: {
        skills: input.skills,
        complexity: input.complexity,
        domain: normalizedInput.domain,
        scenario: normalizedInput.scenario,
        techStack: input.techStack,
        seedId: selectedSeed.id,
        mutationLog: generated.mutationLog
      },
      evaluationGuidance: normalized.evaluationGuidance,
      generatedBy: "req2rank-requirement-generator",
      generatedAt: new Date().toISOString(),
      selfReviewPassed: normalized.selfReviewPassed
    };
  }
}

export const defaultSeeds = DEFAULT_SEEDS;
