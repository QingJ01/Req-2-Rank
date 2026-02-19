import { Complexity, ProjectRequirement } from "./types.js";

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

export class RequirementGenerator {
  private readonly seeds: RequirementSeed[];

  constructor(seeds: RequirementSeed[] = DEFAULT_SEEDS) {
    this.seeds = seeds;
  }

  generate(input: GenerationInput): ProjectRequirement {
    const seedValue = input.seed ?? `${input.domain}:${input.scenario}:${Date.now()}`;
    const rng = new SeededRng(seedValue);
    const selectedSeed = chooseSeed(input, this.seeds, rng);
    const generated = fillTemplate(selectedSeed, input, rng);

    const requirementId = `req-${Math.floor(rng.next() * 1_000_000)}`;
    const functionalRequirements = [
      {
        id: "FR-1",
        description: "Implement all core behavior described in the generated requirement.",
        acceptanceCriteria: "All required flows run successfully for valid input.",
        priority: "must" as const
      },
      {
        id: "FR-2",
        description: "Handle at least one explicit edge case with deterministic behavior.",
        acceptanceCriteria: "Edge case behavior is documented and covered by tests.",
        priority: "must" as const
      }
    ];

    const constraints = [
      `Complexity constrained to ${input.complexity}`,
      "Output must include implementation and test files."
    ];

    if (input.extraConstraints) {
      constraints.push(...input.extraConstraints);
    }

    return {
      id: requirementId,
      version: "1.0",
      title: `${input.domain} / ${input.scenario} / ${input.complexity}`,
      description: generated.text,
      functionalRequirements,
      constraints,
      expectedDeliverables: ["source code", "tests", "README section"],
      metadata: {
        skills: input.skills,
        complexity: input.complexity,
        domain: input.domain,
        scenario: input.scenario,
        techStack: input.techStack,
        seedId: selectedSeed.id,
        mutationLog: generated.mutationLog
      },
      evaluationGuidance: {
        keyDifferentiators: ["edge-case coverage", "error handling clarity", "maintainable module boundaries"],
        commonPitfalls: ["missing input validation", "implicit behavior without tests"],
        edgeCases: ["empty input", "invalid enum value", "duplicate request handling"]
      },
      generatedBy: "req2rank-requirement-generator",
      generatedAt: new Date().toISOString(),
      selfReviewPassed: true
    };
  }
}

export const defaultSeeds = DEFAULT_SEEDS;
