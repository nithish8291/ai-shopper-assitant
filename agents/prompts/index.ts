import { Product } from "@/lib/shopping-memory";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SEARCH_INTENT_PROMPT } from "./search.intent.prompt";
import { SKU_INTENT_PROMPT } from "./sku.intent.prompt";
import { CART_INTENT_PROMPT } from "./cart.intent.prompt";
import { CHECKOUT_INTENT_PROMPT } from "./checkout.intent.prompt";

const PRODUCT_CONTEXT_PATH = path.join(
  process.cwd(),
  "agents",
  "utils",
  "product-context.md",
);

const PRODUCT_CONTEXT_MARKDOWN = readProductContext();

const CATALOG_PROMPT = `
You are an AI Shopping Assistant Agent for an eCommerce platform.

Your task is to analyze the user's message, identify their intent, and determine which tool to invoke with appropriate parameters.

You must return ONLY valid JSON with no explanations.

## Available Tools

${SEARCH_INTENT_PROMPT}

${SKU_INTENT_PROMPT}

Return ONLY JSON.
`;

const CHECKOUT_PROMPT = `
You are an AI Shopping Assistant Agent for an eCommerce platform.
Your task is to analyze the user's message, identify their intent, and determine which tool to invoke with appropriate parameters.

You must return ONLY valid JSON with no explanations.
## Available Tools

${CHECKOUT_INTENT_PROMPT}

Return ONLY JSON.
`;


const CART_PROMPT = `
You are an AI Shopping Assistant Agent for an eCommerce platform.
Your task is to analyze the user's message, identify their intent, and determine which tool to invoke with appropriate parameters.

You must return ONLY valid JSON with no explanations.
## Available Tools

${CART_INTENT_PROMPT}

Return ONLY JSON.
`;


export function buildCatalogPrompt(
  userInput: string,
  context?: Record<string, unknown>,
): string {
  const contextStr = context ? JSON.stringify(context) : "{}";
  return `
${CATALOG_PROMPT}

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

export function buildCatalogSuggestPrompt(
  userInput: string
): string {
  return `

-----------------------------------
PRODUCT KNOWLEDGE BASE
-----------------------------------
${PRODUCT_CONTEXT_MARKDOWN}

-----------------------------------

-----------------------------------
USER MESSAGE
-----------------------------------
${userInput}

Rules return the json response in the following format:
{
  "action": "suggest_products",
  "intent": "",
  "tool": "suggest_products",
  "nextAction": "search_products",
  "should_invoke_tool": true,
  "parameters": {
    "query": "string",
   },
   response_message: "string",
   reason : "string"
`;
}

function readProductContext(): string {
  try {
    return readFileSync(PRODUCT_CONTEXT_PATH, "utf8");
  } catch {
    return "";
  }
}


export function buildCheckoutPrompt(
  userInput: string,
  context?: Record<string, unknown>,
): string {
  const contextStr = context ? JSON.stringify(context) : "{}";
  return `
${CHECKOUT_PROMPT}

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

export function buildCartPrompt(
  userInput: string,
  context?: Record<string, unknown>,
): string {
  const contextStr = context ? JSON.stringify(context) : "{}";
  return `
${CART_PROMPT}

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
      - details from the product information provided below.

       Do not use any information that is not included in the product details.

      Product:
      ${productStr}

      User Question:
      ${userInput}

      Generate a concise and helpful answer

      When action is answer_from_context:
        - Generate response_message using description, FAQ, specifications, and details from the product information provided.
        - Do not return placeholder text like:
          "Fetching details..."
        - Return the final user-facing answer.
      `
}


export const buildCartAnswerPrompt = (userInput: string, cart: any): string => {
  const cartStr = JSON.stringify(cart, null, 2);
  return `
      You are a cart assistant. 
      Answer the user's question using ONLY the cart information provided below.
      Do not use any information that is not included in the cart details.

      Cart:
      ${cartStr}  
      
      User Question:
      ${userInput}

      Rules : 

      - If the cart is empty, respond with "Your cart is currently empty."
      - If the cart has items, provide a summary of the items, their quantities, and total price.
      - If the user asks about a specific item, provide details about that item from the cart.
      - If the user asks about checkout, provide instructions on how to proceed to checkout.
      - If the user asks about the shipping address, provide the shipping address from the cart.
      - If the user ask about items in the cart, provide the list of items in the cart with their quantities and prices.
      - Ignore rest of the request with message as not authorized to provide this information about the cart.
      Send clean styled response without any extra text or explanations.
      Generate a concise and helpful answer
      `;
}
