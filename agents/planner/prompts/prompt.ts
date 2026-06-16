import { Product } from "@/lib/shopping-memory";
import { SEARCH_PRODUCTS_PROMPT } from "./search.prompt";

const SEARCH_SYSTEM_PROMPT = `
You are an AI Shopping Assistant Agent for an eCommerce platform.

Your task is to analyze the user's message, identify their intent, and determine which tool to invoke with appropriate parameters.

You must return ONLY valid JSON with no explanations.

## Available Tools

${SEARCH_PRODUCTS_PROMPT}

Return ONLY JSON.
`;

export function buildPlannerPrompt(
  userInput: string,
  context?: Record<string, unknown>,
): string {
  const contextStr = context ? JSON.stringify(context) : "{}";
  return `
${SEARCH_SYSTEM_PROMPT}

-----------------------------------
CONVERSATION CONTEXT
-----------------------------------
${contextStr}

-----------------------------------
WORKFLOW RULES

1. Product Search
- If the user wants to search or browse products:
  - action = invoke_tool
  - tool = search_products
  - shouldInvokeTool = true

2. Product Details In Context
- If product exists in lastProducts or selectedProduct:
  - action = answer_from_context
  - shouldInvokeTool = false
  - Generate the response using description, FAQ and specifications.

3. Product Details Not In Context
- If product is not found in context:
  - action = invoke_tool
  - tool = search_products
  - shouldInvokeTool = true
  - nextAction = generate_product_answer

4. After search_products completes:
- If nextAction = generate_product_answer:
  - Use search result data to generate the final answer.
  - Do not return raw product data.

-----------------------------------
USER MESSAGE
-----------------------------------
${userInput}

`;
}

export const buildProductAnswerPrompt = (userInput: string, product: Product): string => {
  const productStr = JSON.stringify(product, null, 2);
  return `
      You are a product assistant.

      Answer the user's question using ONLY:
      - description
      - FAQ
      - specifications

      Product:
      ${productStr}

      User Question:
      ${userInput}

      Generate a concise and helpful answer

      When action is answer_from_context:
        - Generate response_message using description, FAQ and specifications.
        - Do not return placeholder text like:
          "Fetching details..."
        - Return the final user-facing answer.
      `
}
