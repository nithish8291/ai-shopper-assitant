import { callMCPTool } from "@/lib/mcp-client";
import {
  ShoppingContext,
  Product,
  getShoppingContext,
  updateShoppingContext,
} from "@/lib/shopping-memory";
import { CatalogSearchAgent, CatalogSuggestAgent, generateCartAnswerAgent, generateProductAnswerAgent } from "@/agents/catalog/index";
import { CartAgent, CheckoutAgent } from "@/agents/checkout/index";
import { SupervisorDecision } from "@/agents/supervisor/index";
import { ToolCallResult } from "@/agents/types/type";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const VALID_TOOLS = [
  "search_products",
  "get_sku_details",
  "create_new_cart",
  "get_cart",
  "add_item_to_cart",
  "update_item_in_cart",
  "get_address_options",
  "proceed_to_checkout",
  "set_client_profile",
  "set_shipping_address",
  "get_company_address",
  "place_order",
  "suggest_products"
] as const;

const ORDERFORM_REDIS_TOOLS = new Set([
  "add_item_to_cart",
  "update_item_in_cart",
  "get_cart",
  "create_new_cart",
]);

const MAX_STEPS = 1;

type MCPContent = Array<{ text?: string }>;
type MCPToolResult = {
  isError?: boolean;
  content?: MCPContent;
};

const isValidTool = (tool: string): boolean => {
  return (VALID_TOOLS as readonly string[]).includes(tool);
};

const sanitizeParameters = (
  params: Record<string, unknown>
): Record<string, unknown> => {
  return Object.fromEntries(
    Object.entries(params).filter(([_, value]) => value !== null && value !== undefined)
  );
};

export interface ExecutionStep {
  tool: string;
  parameters: Record<string, unknown>;
  result?: unknown;
  message?: string;
}

export interface ExecutionResult {
  success: boolean;
  tool?: string;
  finalMessage: string;
  responseMessage?: string;
  reason?: string;
  price?: unknown;
  clarificationNeeded?: string;
  shoppingContext: ShoppingContext;
  data?: unknown;
  suggestedProduct?: string;
  suggestedCapacity?: string;
}

function getToolName(toolCall: ToolCallResult): string {
  return toolCall.tool || "";
}
function getToolCallPrice(toolCall: ToolCallResult): unknown {
  return toolCall.parameters.price ?? toolCall.parameters.priceRange ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getContentText(result: unknown): string | null {
  const content = (result as MCPToolResult | undefined)?.content;
  if (Array.isArray(content) && content[0]?.text) {
    return content[0].text;
  }
  return null;
}

function parseContentText(result: unknown): Record<string, unknown> | null {
  const text = getContentText(result);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function persistOrderFormSnapshot(sessionId: string, tool: string, result: unknown): Promise<void> {
  if (!ORDERFORM_REDIS_TOOLS.has(tool)) {
    return;
  }

  const contentText = getContentText(result);
  const raw = contentText || (typeof result === "string" ? result : JSON.stringify(result));
  if (!raw) {
    return;
  }

  await redis.set(`orderform:${sessionId}`, raw);
}

function normalizeAddItemResult(parameters: Record<string, unknown>, result: unknown): string | null {
  try {
    const skuParam = String(parameters.skuId ?? parameters.sku ?? "");
    const qtyParam = Number(parameters.quantity ?? parameters.qty ?? parameters.qtd ?? 1);

    const parsed = parseContentText(result) || (result as Record<string, unknown>);
    const items =
      (parsed as { items?: unknown[]; order?: { items?: unknown[] }; orderForm?: { items?: unknown[] } })
        ?.items ||
      (parsed as { order?: { items?: unknown[] } })?.order?.items ||
      (parsed as { orderForm?: { items?: unknown[] } })?.orderForm?.items ||
      [];

    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    const found = items.find((it) => {
      const item = it as Record<string, unknown>;
      const candidateSku = String(
        item.skuId || item.id || item.itemId || item.productId || ""
      );
      return candidateSku === skuParam || skuParam === "";
    }) as Record<string, unknown> | undefined;

    if (!found) {
      return null;
    }

    const addedItem = {
      name:
        found.name || found.productName || found.itemName || found.title || null,
      price: found.sellingPrice ?? found.price ?? found.unitPrice ?? null,
      quantity: found.quantity ?? found.qty ?? qtyParam,
    };

    const content = (result as MCPToolResult)?.content;
    if (Array.isArray(content) && content[0]) {
      content[0].text = JSON.stringify({
        orderFormId:
          (parsed as { orderFormId?: string; id?: string }).orderFormId ||
          (parsed as { id?: string }).id ||
          null,
        addedItem,
      });
    }

    return `Added ${addedItem.quantity} x ${addedItem.name} to your cart.`;
  } catch {
    return null;
  }
}


function resolveProductFromContext(
  context: ShoppingContext,
  params: Record<string, unknown>
): Product | undefined {
  const productId = params.productId as string | undefined;

  if (productId) {
    return context.lastProducts?.find(
      p => p.productId === productId
    );
  }

  return undefined;
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
async function resolveAgentToolCall(
  agentToInvoke: SupervisorDecision["agentToInvoke"],
  userMessage: string,
  context: Record<string, unknown>
): Promise<ToolCallResult> {
  switch (agentToInvoke) {
    case "CatalogSuggestAgent":
      return CatalogSuggestAgent(userMessage);
    case "CatalogSearchAgent":
      return CatalogSearchAgent(userMessage, context);
    case "CartAgent":
      return CartAgent(userMessage, context);
    case "CheckoutAgent":
    case "OrderAgent":
      return CheckoutAgent(userMessage, context);
    default:
      return CatalogSearchAgent(userMessage, context);
  }
}

export async function executeLoop(
  sessionId: string,
  userMessage: string,
  customerData: Record<string, unknown>,
  supervisorDecision?: SupervisorDecision
): Promise<ExecutionResult> {
  let shoppingContext: ShoppingContext = {};
  try {
    shoppingContext = await getShoppingContext(sessionId);
  } catch (err) {
    console.warn("Failed to load shopping context from Redis:", err);
  }

  let lastToolResult: unknown = null;
  let lastTool = "none";
  let finalMessage = "";
  let lastResponseMessage: string | undefined;
  let lastReason: string | undefined;
  let lastPrice: unknown;
  let suggestedProduct: string | undefined;
  let suggestedCapacity: string | undefined;
  let currentMessage = userMessage;

  for (let i = 0; i < MAX_STEPS; i++) {
    // Build enriched context from shopping memory + previous tool results
    const enrichedContext = buildEnrichedContext(
      shoppingContext,
      lastToolResult,
      customerData
    );

    console.log("----------------------enrichedContext")
    console.log(JSON.stringify(enrichedContext, null, 2 ));
    
    const toolCall = supervisorDecision
      ? await resolveAgentToolCall(supervisorDecision.agentToInvoke, currentMessage, enrichedContext)
      : await CatalogSearchAgent(currentMessage, enrichedContext);
    
    console.log("-------------------toolCall");
    console.log(toolCall)
    
    const toolName = getToolName(toolCall);
    lastTool = toolName || "none";
    lastResponseMessage = toolCall.response_message;
    if (toolName === "suggest_products") {
      lastReason = toolCall.reason;
      lastPrice = toolCall.price;
      suggestedProduct = toolCall.suggested_product;
      suggestedCapacity = toolCall.suggested_capacity;
    } else {
      lastReason = undefined;
      lastPrice = undefined;
      suggestedProduct = undefined;
      suggestedCapacity = undefined;
    }

    // If no tool is needed, return conversational response
    if (toolName === "none" || !isValidTool(toolName)) {
      finalMessage = toolCall.response_message;
      break;
    }

    if (toolName === "place_order" && toolCall.shouldInvokeTool === true) {
      
      toolCall.parameters = {
        ... customerData,
        ...toolCall.parameters
      };
    }

    const parameters = resolveParameters(toolCall, shoppingContext);

    if (
        toolCall.action === "answer_from_context" 
      ) {
        const product = resolveProductFromContext(
          shoppingContext,
          parameters
        );

        if (product) {
          finalMessage = await generateProductAnswerAgent(
            userMessage,
            product
          );
          lastTool = "product_detail";
        } else {
          finalMessage = toolCall.response_message;
        }

        break;
      }

    if(toolCall.shouldInvokeTool === false) {
      break
    } 
    // Check if clarification is needed
    const clarification = detectClarification(toolCall, shoppingContext);
    if (clarification) {
      return {
        success: true,
        tool: toolName,
        finalMessage: clarification,
        responseMessage: toolCall.response_message,
        clarificationNeeded: clarification,
        shoppingContext,
      };
    }

    if (
      toolCall.action === "display_product"
    ) {
      const product = resolveProductFromContext( 
        shoppingContext,
        parameters
      );

      finalMessage = product?.productName ?? "Product not found";

      return {
        success: true,
        tool: toolName,
        finalMessage,
        responseMessage: toolCall.response_message,
        shoppingContext,
        data: product
      };
    }
    // Check for missing required parameters that need clarification
    const missingParam = checkMissingRequiredParams(toolName, parameters);
    if (missingParam) {
      return {
        success: true,
        tool: toolName,
        finalMessage: missingParam,
        responseMessage: toolCall.response_message,
        clarificationNeeded: missingParam,
        shoppingContext,
      };
    }

    const sanitizedParameters = sanitizeParameters(parameters);

    console.log("-------------------reeacjed tool invoke");
    
    // Execute the tool
    let toolResult: unknown;
    try {
      if(toolName === "suggest_products"){
        toolResult = await callMCPTool(toolCall.nextAction, sanitizedParameters);
      }else{
        toolResult = await callMCPTool(toolName, sanitizedParameters);
      }
    } catch (err) {
      console.error(`MCP tool call failed for ${toolName}:`, err);
      const errorMsg = err instanceof Error ? err.message : "Tool execution failed";
      return {
        success: false,
        tool: toolName,
        finalMessage: `Sorry, I encountered an error while executing that action: ${errorMsg}. Please try again.`,
        responseMessage: toolCall.response_message,
        shoppingContext,
        data: null,
      };
    }

    // Persist order form-like results to Redis under key `orderform:${sessionId}`

    if ((toolResult as MCPToolResult)?.isError) {
      return {
        success: false,
        tool: toolName,
        data: toolResult,
        finalMessage: getContentText(toolResult) || "An error occurred while executing the action.",
        responseMessage: toolCall.response_message,
        shoppingContext,
      };
    }

    const parsedToolResult = parseContentText(toolResult) || {};

    if ((parsedToolResult as { checkoutUrl?: string }).checkoutUrl) {
      return {
        success: true,
        tool: "complete_payment",
        finalMessage: "Checkout URL available",
        responseMessage: toolCall.response_message,
        shoppingContext,
        data: toolResult,
      };
    }

    try {
      await persistOrderFormSnapshot(sessionId, toolName, toolResult);
    } catch (err) {
      console.warn("Failed saving order form to Redis:", err);
    }

    lastToolResult = toolResult;

    // Update shopping context based on tool results
    try {
      await updateContextFromResult(
        sessionId,
        shoppingContext,
        toolName,
        parameters,
        toolResult
      );
    } catch (err) {
      console.warn("Failed to persist shopping context:", err);
    }

    finalMessage = toolCall.response_message;


    // If this was an add_item_to_cart call, extract skuId and quantity from parameters
    // and try to find the corresponding item in the returned order/cart to build a simplified addedItem
    if (toolName === "add_item_to_cart") {
      const normalizedMessage = normalizeAddItemResult(parameters, toolResult);
      if (normalizedMessage) {
        finalMessage = normalizedMessage;
      }
    }

    if (toolCall.nextAction === "generate_product_answer") {
      const productForAnswer =
        (isRecord(toolResult) ? extractProduct(toolResult) : null) ||
        resolveProductFromContext(shoppingContext, parameters);

      if (productForAnswer) {
        finalMessage = await generateProductAnswerAgent(
          userMessage,
          productForAnswer
        );
      } else {
        finalMessage = toolCall.response_message;
      }
      break;
    }

    if (toolCall.nextAction === "generate_cart_answer") {
      finalMessage = await generateCartAnswerAgent(
        userMessage,
        parseContentText(toolResult) || []
      );
      break;
    }
    
    // Determine if we need another step (e.g., auto-creating cart before adding item)
    const nextAction = determineNextStep(toolName, toolResult, shoppingContext);
    if (!nextAction) {
      break;
    }

    // Feed the next action back into the loop
    currentMessage = nextAction;
  }

  return {
    success: true,
    tool: lastTool,
    finalMessage,
    responseMessage: lastResponseMessage ?? finalMessage,
    ...(lastTool === "suggest_products"
      ? {
          reason: lastReason,
          price: lastPrice,
          suggestedProsuct: suggestedProduct,
          suggestedCapacity: suggestedCapacity
        }
      : {}),
    shoppingContext: await getShoppingContext(sessionId),
    data: lastToolResult,
  };
}

/**
 * Build enriched context by combining shopping memory with tool execution history
 */
function buildEnrichedContext(
  shoppingContext: ShoppingContext,
  lastToolResult: unknown,
  customerData: Record<string, unknown>
): Record<string, unknown> {
  const context: Record<string, unknown> = {
    orderFormId: shoppingContext.orderFormId || null,
    selectedSkuId: shoppingContext.selectedSku || null,
  };

  if (shoppingContext.selectedProduct) {
    context.selectedProduct = shoppingContext.selectedProduct;
  }
  
  if (shoppingContext.lastProducts?.length) {
    context.lastProducts = shoppingContext.lastProducts.map((p) => ({
      productId: p?.productId,
      productName: p?.productName,
      skuId: p?.defaultSku[0]?.skuId,
      defaultSku: p?.defaultSku,
      skuOptions: p?.skuOptions
    }));
  }

  if (lastToolResult) {
    context.lastToolResult = lastToolResult;
  }

  context.customerData = customerData;

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
    toolCall.action === "ask_clarification"
  ) {
    if (shoppingContext.lastProducts?.length) {
      const productList = shoppingContext.lastProducts
        .map((p, i) => `${i + 1}. ${p.productName}`)
        .join("\n");
      return `Which product would you like to know more about?\n${productList}`;
    }
    return "Which product would you like to know more about? Please search for a product first.";
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
  if (!params.sellerId && shoppingContext.selectedProduct?.seller) {
    params.sellerId = shoppingContext.selectedProduct.seller;
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
    case "suggest_products":
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
        patch.selectedProduct = product.defaultSku[0];
        patch.selectedSku = product.defaultSku[0]?.skuId;
      }
      break;
    }
    case "add_item_to_cart": {
      const orderFormId = extractOrderFormId(res);
      if (orderFormId) {
        patch.orderFormId = orderFormId;
        patch.orderFormItems = extractOrderFormItems(res);
      }
      break;
    }
    case "update_item_in_cart": {
      // Cart updated, keep orderFormId current
      const updatedOrderFormId = extractOrderFormId(res);
      if (updatedOrderFormId) {
        patch.orderFormId = updatedOrderFormId;
        patch.orderFormItems = extractOrderFormItems(res);
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
 * Extract products from search results
 */
function extractProducts(res: Record<string, unknown> | undefined): Product[] {
  if (!res) return [];
  try {
    const content = res.content as Array<{ text?: string }> | undefined;
    if (content?.[0]?.text) {
      const parsed = JSON.parse(content[0].text);
      if (Array.isArray(parsed)) {
        return parsed.map((p: Product) => ({
          productId: String(p.productId || ""),
          productName: String(p.productName || ""),
          price: Number(p.defaultSku?.[0]?.price || 0),
          defaultSku: p.defaultSku,
          skuOptions: p.skuOptions,
          faq: String(p.FAQ || ""),
          description: String(p.description || "")
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
        productId: String(parsed.productId || parsed.id || ""),
        productName: String(parsed.productName || parsed.name || ""),
        defaultSku: [
          {
            skuId: String(parsed.skuId || parsed.sku || ""),
            price: Number(parsed.price || parsed.Price || 0),
            available: Boolean(parsed.available || parsed.Available || false),
            seller: String(parsed.seller || parsed.Seller || ""),
            referenceId: String(parsed.referenceId || parsed.ReferenceId || ""),
            imageUrl: String(parsed.imageUrl || parsed.image || ""),
            name: String(parsed.name || parsed.Name || ""),
          },
        ],
        skuOptions: [],
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

function extractOrderFormItems(
  res: Record<string, unknown> | undefined
): ShoppingContext["orderFormItems"] | undefined {
  if (!res) return undefined;

  try {
    const content = res.content as Array<{ text?: string }> | undefined;
    if (content?.[0]?.text) {
      const parsed = JSON.parse(content[0].text);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];
      return items.map((it: Record<string, unknown>) => ({
        id: String(it.id ?? it.skuId ?? ""),
        quantity: Number(it.quantity ?? 0),
        price: Number(it.price ?? it.sellingPrice ?? it.unitPrice ?? 0),
        skuName: it.skuName ? String(it.skuName) : undefined,
        name: it.name ? String(it.name) : undefined,
        skuId: it.skuId ? String(it.skuId) : undefined,
      }));
    }
  } catch {
    // Ignore parse errors
  }

  return undefined;
}