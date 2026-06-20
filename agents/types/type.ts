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

export type AgentAction =
  | "invoke_tool"
  | "answer_from_context"
  | "ask_clarification"
  | "display_product"
  | "no_action";

export type NextAction =
  | ""
  | "generate_product_answer"
  | "generate_cart_answer"
  | "get_sku_details"
  | "display_product"
  | "add_to_cart"
  | "create_cart"
  | "checkout"
  | "search_products";

export interface ToolCallResult {
  action: AgentAction;
  tool: string;
  nextAction: NextAction;
  parameters: {
    query?: string;
    productId?: string;
    productReference?: string;
    category?: string;
    priceRange?: string;
    orderFormId?: string;
    [key: string]: unknown;
  };
  shouldInvokeTool: boolean;
  confidence: number;
  reason?: string;
  price?: string;
  response_message: string;
  suggested_product?: string;
  suggested_capacity?: string;
}