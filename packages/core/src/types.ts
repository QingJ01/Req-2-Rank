export type Complexity = "C1" | "C2" | "C3" | "C4";

export type RequirementPriority = "must" | "should" | "nice-to-have";

export interface FunctionalRequirement {
  id: string;
  description: string;
  acceptanceCriteria: string;
  priority: RequirementPriority;
}

export interface EvaluationGuidance {
  keyDifferentiators: string[];
  commonPitfalls: string[];
  edgeCases: string[];
}

export interface ProjectRequirement {
  id: string;
  version: string;
  title: string;
  description: string;
  functionalRequirements: FunctionalRequirement[];
  constraints: string[];
  expectedDeliverables: string[];
  metadata: {
    skills: string[];
    complexity: Complexity;
    domain: string;
    scenario: string;
    techStack: string[];
    seedId?: string;
    mutationLog: string[];
  };
  evaluationGuidance: EvaluationGuidance;
  generatedBy: string;
  generatedAt: string;
  selfReviewPassed: boolean;
}
