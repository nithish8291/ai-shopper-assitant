export type PlannerMode = "NEW_APP" | "EXISTING_APP";

export interface PlanStep {
  step: number;
  module: string;
  action: "create" | "update" | "extend" | "reuse";
  name: string;
  file: string;
  description: string;
}

export interface PlannerPlan {
  feature: string;
  mode: PlannerMode;
  modules: string[];
  steps: PlanStep[];
}

export interface ToolCallResult {
  tool: string;
  parameters: Record<string, unknown>;
  confidence: number;
  reasoning: string;
  response_message: string;
}