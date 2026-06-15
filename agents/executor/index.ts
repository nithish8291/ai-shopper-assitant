import { callMCPTool } from "@/lib/mcp-client";
import {
  ShoppingContext,
  Product,
  getShoppingContext,
  updateShoppingContext,
} from "@/lib/shopping-memory";
import { runIntentAgent } from "@/agents/planner/index";
import { ToolCallResult } from "@/agents/types/type";

const VALID_TOOLS = [
  "search_products",
  "get_sku_details",
  "create_new_cart",
  "get_cart",
  "update_item_in_cart",
  "get_address_options",
  "proceed_to_checkout",
  "set_client_profile",
  "set_shipping_address",
  "get_company_address",
  "place_order",
];

const MAX_STEPS = 5;

export interface ExecutionStep {
  tool: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  message?: string;
}

export interface ExecutionResult {
  success: boolean;
  steps: ExecutionStep[];
  finalMessage: string;
  clarificationNeeded?: string;
  shoppingContext: ShoppingContext;
  data?: unknown;
}

/**
 * Multi-step execution loop that:
 * 1. Resolves intent from user message
 * 2. Injects shopping memory context
 * 3. Executes tool calls
 * 4. Feeds tool results back for follow-up decisions
 * 5. Handles clarification when needed
 * 6. Persists updated shopping context
 */
export async function executeLoop(
  sessionId: string,
  userMessage: string
): Promise<ExecutionResult> {
  const shoppingContext = await getShoppingContext(sessionId);
  const steps: ExecutionStep[] = [];
  let lastToolResult: unknown = null;
  let finalMessage = "";
  let currentMessage = userMessage;

  for (let i = 0; i < MAX_STEPS; i++) {
    // Build enriched context from shopping memory + previous tool results
    const enrichedContext = buildEnrichedContext(
      shoppingContext,
      steps,
      lastToolResult
    );

    // Run intent agent with full context
    const toolCall = await runIntentAgent(currentMessage, enrichedContext);

    // Check if clarification is needed
    const clarification = detectClarification(toolCall, shoppingContext);
    if (clarification) {
      return {
        success: true,
        steps,
        finalMessage: clarification,
        clarificationNeeded: clarification,
        shoppingContext,
      };
    }

    // If no tool is needed, return conversational response
    if (toolCall.tool === "none" || !VALID_TOOLS.includes(toolCall.tool)) {
      finalMessage = toolCall.response_message;
      break;
    }

    // Resolve parameters with shopping memory
    const parameters = resolveParameters(toolCall, shoppingContext);

    // Check for missing required parameters that need clarification
    const missingParam = checkMissingRequiredParams(toolCall.tool, parameters);
    if (missingParam) {
      return {
        success: true,
        steps,
        finalMessage: missingParam,
        clarificationNeeded: missingParam,
        shoppingContext,
      };
    }

    // Execute the tool
    const toolResult = await callMCPTool(toolCall.tool, parameters);

    const step: ExecutionStep = {
      tool: toolCall.tool,
      parameters,
      result: toolResult,
      message: toolCall.response_message,
    };
    steps.push(step);
    lastToolResult = toolResult;

    // Update shopping context based on tool results
    await updateContextFromResult(
      sessionId,
      shoppingContext,
      toolCall.tool,
      parameters,
      toolResult
    );

    finalMessage = toolCall.response_message;

    // Determine if we need another step (e.g., auto-creating cart before adding item)
    const nextAction = determineNextStep(toolCall.tool, toolResult, shoppingContext);
    if (!nextAction) {
      break;
    }

    // Feed the next action back into the loop
    currentMessage = nextAction;
  }

  return {
    success: true,
    steps,
    finalMessage,
    shoppingContext: await getShoppingContext(sessionId),
    data: lastToolResult,
  };
}

/**
 * Build enriched context by combining shopping memory with tool execution history
 */
function buildEnrichedContext(
  shoppingContext: ShoppingContext,
  steps: ExecutionStep[],
  lastToolResult: unknown
): Record<string, unknown> {
  const context: Record<string, unknown> = {
    orderFormId: shoppingContext.orderFormId || null,
    cartId: shoppingContext.cartId || null,
    selectedSkuId: shoppingContext.selectedSku || null,
  };

  if (shoppingContext.selectedProduct) {
    context.selectedProduct = shoppingContext.selectedProduct;
  }

  if (shoppingContext.lastProducts?.length) {
    context.lastProducts = shoppingContext.lastProducts.map((p) => ({
      id: p.id,
      name: p.name,
      skuId: p.skuId,
    }));
  }

  // Inject previous step results for multi-step awareness
  if (steps.length > 0) {
    context.previousSteps = steps.map((s) => ({
      tool: s.tool,
      success: !!s.result,
      summary: summarizeToolResult(s.tool, s.result),
    }));
  }

  if (lastToolResult) {
    context.lastToolResult = lastToolResult;
  }

  return context;
}

/**
 * Detect when the agent needs to ask for clarification
 */
function detectClarification(
  toolCall: ToolCallResult,
  shoppingContext: ShoppingContext
): string | null {
  // Low confidence indicates ambiguity
  if (toolCall.confidence < 0.5 && toolCall.tool !== "none") {
    return `I'm not quite sure what you'd like me to do. ${toolCall.response_message} Could you please clarify?`;
  }

  // Adding to cart but no product selected and no SKU provided
  if (
    toolCall.tool === "update_item_in_cart" &&
    !toolCall.parameters.skuId &&
    !shoppingContext.selectedSku
  ) {
    if (shoppingContext.lastProducts?.length) {
      const productList = shoppingContext.lastProducts
        .map((p, i) => `${i + 1}. ${p.name}`)
        .join("\n");
      return `Which product would you like to add to your cart?\n${productList}`;
    }
    return "Which product would you like to add to your cart? Please search for a product first.";
  }

  // Checkout without cart
  if (
    toolCall.tool === "proceed_to_checkout" &&
    !toolCall.parameters.orderFormId &&
    !shoppingContext.orderFormId
  ) {
    return "You don't have an active cart yet. Would you like me to search for products first?";
  }

  return null;
}

/**
 * Resolve parameters using shopping memory fallbacks
 */
function resolveParameters(
  toolCall: ToolCallResult,
  shoppingContext: ShoppingContext
): Record<string, unknown> {
  const params = { ...toolCall.parameters };

  // Inject orderFormId from memory
  if (!params.orderFormId && shoppingContext.orderFormId) {
    params.orderFormId = shoppingContext.orderFormId;
  }

  // Inject skuId from memory
  if (!params.skuId && shoppingContext.selectedSku) {
    params.skuId = shoppingContext.selectedSku;
  }

  // Inject sellerId from selected product
  if (!params.sellerId && shoppingContext.selectedProduct?.sellerId) {
    params.sellerId = shoppingContext.selectedProduct.sellerId;
  }

  return params;
}

/**
 * Check for truly missing required parameters
 */
function checkMissingRequiredParams(
  tool: string,
  parameters: Record<string, unknown>
): string | null {
  switch (tool) {
    case "update_item_in_cart":
      if (!parameters.orderFormId) {
        return "I need to create a cart first. Would you like me to do that?";
      }
      if (!parameters.skuId) {
        return "Which product would you like to add? Please select one from the results or search for a product.";
      }
      break;
    case "proceed_to_checkout":
    case "get_cart":
    case "get_address_options":
    case "set_client_profile":
    case "set_shipping_address":
    case "place_order":
      if (!parameters.orderFormId) {
        return "You don't have an active cart. Would you like me to create one for you?";
      }
      break;
  }
  return null;
}

/**
 * Update shopping context based on tool execution results
 */
async function updateContextFromResult(
  sessionId: string,
  shoppingContext: ShoppingContext,
  tool: string,
  parameters: Record<string, unknown>,
  result: unknown
): Promise<void> {
  const patch: Partial<ShoppingContext> = {};
  const res = result as Record<string, unknown> | undefined;

  switch (tool) {
    case "search_products": {
      const products = extractProducts(res);
      if (products.length > 0) {
        patch.lastProducts = products;
      }
      break;
    }
    case "get_sku_details": {
      const product = extractProduct(res);
      if (product) {
        patch.selectedProduct = product;
        patch.selectedSku = product.skuId;
      }
      break;
    }
    case "create_new_cart": {
      const orderFormId = extractOrderFormId(res);
      if (orderFormId) {
        patch.orderFormId = orderFormId;
        patch.cartId = orderFormId;
      }
      break;
    }
    case "update_item_in_cart": {
      // Cart updated, keep orderFormId current
      const updatedOrderFormId = extractOrderFormId(res);
      if (updatedOrderFormId) {
        patch.orderFormId = updatedOrderFormId;
      }
      break;
    }
    case "place_order": {
      // Order placed, clear cart context
      patch.orderFormId = undefined;
      patch.cartId = undefined;
      patch.selectedProduct = undefined;
      patch.selectedSku = undefined;
      break;
    }
  }

  if (Object.keys(patch).length > 0) {
    Object.assign(shoppingContext, patch);
    await updateShoppingContext(sessionId, patch);
  }
}

/**
 * Determine if a follow-up step is needed automatically
 */
function determineNextStep(
  tool: string,
  result: unknown,
  shoppingContext: ShoppingContext
): string | null {
  // If we just created a cart and the user's original intent was to add something
  if (tool === "create_new_cart" && shoppingContext.selectedSku) {
    return `Add the selected product (SKU: ${shoppingContext.selectedSku}) to the cart`;
  }

  return null;
}

/**
 * Summarize tool results for context injection
 */
function summarizeToolResult(tool: string, result: unknown): string {
  if (!result) return "No result";
  const res = result as Record<string, unknown>;

  switch (tool) {
    case "search_products": {
      const content = res.content as Array<{ text?: string }> | undefined;
      if (content?.[0]?.text) {
        return `Found products`;
      }
      return "Search completed";
    }
    case "create_new_cart":
      return "Cart created";
    case "update_item_in_cart":
      return "Cart updated";
    case "get_sku_details":
      return "Product details retrieved";
    case "place_order":
      return "Order placed";
    default:
      return "Completed";
  }
}

/**
 * Extract products from search results
 */
function extractProducts(res: Record<string, unknown> | undefined): Product[] {
  if (!res) return [];

  try {
    const content = res.content as Array<{ text?: string }> | undefined;
    if (content?.[0]?.text) {
      const parsed = JSON.parse(content[0].text);
      if (Array.isArray(parsed)) {
        return parsed.map((p: Record<string, unknown>) => ({
          id: String(p.productId || p.id || ""),
          name: String(p.productName || p.name || ""),
          price: Number(p.price || p.Price || 0),
          skuId: String(p.skuId || p.sku || ""),
          imageUrl: String(p.imageUrl || p.image || ""),
          sellerId: String(p.sellerId || ""),
        }));
      }
    }
  } catch {
    // Ignore parse errors
  }

  return [];
}

/**
 * Extract a single product from SKU details
 */
function extractProduct(res: Record<string, unknown> | undefined): Product | null {
  if (!res) return null;

  try {
    const content = res.content as Array<{ text?: string }> | undefined;
    if (content?.[0]?.text) {
      const parsed = JSON.parse(content[0].text);
      return {
        id: String(parsed.productId || parsed.id || ""),
        name: String(parsed.productName || parsed.name || ""),
        price: Number(parsed.price || parsed.Price || 0),
        skuId: String(parsed.skuId || parsed.sku || ""),
        imageUrl: String(parsed.imageUrl || parsed.image || ""),
        sellerId: String(parsed.sellerId || ""),
      };
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Extract orderFormId from cart-related results
 */
function extractOrderFormId(res: Record<string, unknown> | undefined): string | null {
  if (!res) return null;

  try {
    const content = res.content as Array<{ text?: string }> | undefined;
    if (content?.[0]?.text) {
      const parsed = JSON.parse(content[0].text);
      return parsed.orderFormId || parsed.id || null;
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}
