import { Product } from "@/lib/shopping-memory";
import { SEARCH_INTENT_PROMPT } from "./search.intent.prompt";
import { SKU_INTENT_PROMPT } from "./sku.intent.prompt";
import { CART_INTENT_PROMPT } from "./cart.intent.prompt";
import { CHECKOUT_INTENT_PROMPT } from "./checkout.intent.prompt";

const SYSTEM_PROMPT = `
You are an AI Shopping Assistant Agent for an eCommerce platform.

Your task is to analyze the user's message, identify their intent, and determine which tool to invoke with appropriate parameters.

You must return ONLY valid JSON with no explanations.

## Available Tools

${SEARCH_INTENT_PROMPT}

${SKU_INTENT_PROMPT}

${CART_INTENT_PROMPT}

${CHECKOUT_INTENT_PROMPT}

Return ONLY JSON.
`;

export function buildPlannerPrompt(
  userInput: string,
  context?: Record<string, unknown>,
): string {
  const contextStr = context ? JSON.stringify(context) : "{}";
  return `
${SYSTEM_PROMPT}

-----------------------------------
CONVERSATION CONTEXT
-----------------------------------
${contextStr}

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
