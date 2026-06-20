import { NextRequest, NextResponse } from "next/server";
import { executeLoop } from "@/agents/executor/index";
import { runSupervisorAgent } from "@/agents/supervisor";

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, context, customerData } = await req.json();
    
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Use sessionId from client, or fall back to a default
    const resolvedSessionId = sessionId || context?.sessionId;

    // Temporary short-circuit: inspect supervisor output before execution loop.
    const supervisorResult = await runSupervisorAgent(message, {
      sessionId: resolvedSessionId,
      customerData,
      context,
    });

    console.log("---------------------superresy");
    
    console.log(supervisorResult);
    
    // Run the multi-step execution loop with supervisor routing
    const result = await executeLoop(resolvedSessionId, message, customerData, supervisorResult);

    const intent = result.tool || "none";

    const parseResponseData = (payload: unknown): unknown => {
      if (
        payload &&
        typeof payload === "object" &&
        "content" in payload &&
        Array.isArray((payload as { content?: Array<{ text?: string }> }).content)
      ) {
        const text = (payload as { content: Array<{ text?: string }> }).content[0]?.text;
        if (text) {
          try {
            return JSON.parse(text);
          } catch {
            return payload;
          }
        }
      }

      return payload;
    };

    const parsedData = parseResponseData(result.data);

    const buildSuggestions = (intentName: string, responseData: unknown): string[] => {
      const data = responseData as
        | { items?: unknown[]; addedItem?: { name?: string }; checkoutUrl?: string }
        | unknown[]
        | null
        | undefined;

      switch (intentName) {
        case "search_products": {
          const products = Array.isArray(data) ? data : [];
          if (products.length === 0) {
            return [
              "No matching products found. Try a broader keyword.",
              "Try searching by brand, category, or SKU.",
            ];
          }

          return [
            "I found several matching products — would you like to view details for any of them?",
            "You can add a product to your cart directly from the listing.",
            "Try refining your search with a different keyword or filter to get better results.",
          ];
        }
        case "get_sku_details":
          return [
            "Here are the SKU details — would you like to add this item to your cart?",
            "I can check current availability for this SKU if you want.",
          ];
        case "create_new_cart":
          return [
            "Your cart has been created — add your first item to get started.",
            "You can browse categories to find items to add to your cart.",
          ];
        case "add_item_to_cart":
        case "update_item_in_cart": {
          const addedItemName = !Array.isArray(data) ? data?.addedItem?.name : undefined;
          return [
            addedItemName
              ? `Added ${addedItemName}. Would you like to review your cart now?`
              : "Item updated — would you like to view your cart now?",
            "Proceed to checkout when you're ready to complete the purchase.",
            "Continue shopping to add more items to your cart.",
          ];
        }
        case "get_cart": {
          const items = !Array.isArray(data) ? data?.items : undefined;
          const itemCount = Array.isArray(items) ? items.length : 0;
          if (itemCount === 0) {
            return [
              "Your cart is empty. Search for products to add items.",
              "You can ask for product recommendations based on your needs.",
            ];
          }

          return [
            "This is your current cart — you can update item quantities or remove items.",
            "When you're ready, proceed to checkout to enter shipping and payment details.",
            "You can also apply a coupon code or estimate shipping costs.",
            "You can add items to your cart",
          ];
        }
        case "proceed_to_checkout": {
          const checkoutUrl = !Array.isArray(data) ? data?.checkoutUrl : undefined;
          if (checkoutUrl) {
            return [
              "Your checkout link is ready. Open it to complete payment.",
              "After payment, you can return here and I can help with order tracking.",
            ];
          }

          return [
            "You're ready to checkout — confirm shipping details next.",
            "Then choose payment method and place the order.",
          ];
        }
        case "get_address_options":
          return [
            "Select one of your saved addresses or add a new shipping address.",
            "I can add a new address for you if you'd like to provide the details.",
            "You can also edit an existing address before confirming shipping.",
          ];
        // case "proceed_to_checkout":
        //   return [
        //     "You're ready to checkout — enter your payment details to continue.",
        //     "Choose a shipping method and review the order summary before placing the order.",
        //     "Need to update billing or shipping information? You can do that now.",
        //   ];
        case "set_client_profile":
          return [
            "Your profile was updated — review and confirm the information.",
            "Consider adding company details or a contact person for B2B orders.",
            "You can also add a phone number or tax exemption status if applicable.",
          ];
        case "set_shipping_address":
          return [
            "Shipping address saved — confirm it or choose a different address.",
            "Would you like to select a delivery slot or special instructions?",
            "You can also edit the address details before continuing.",
          ];
        case "get_company_address":
          return [
            "Here is the company address on file — use it as the order address if desired.",
            "Edit or add another company address if this one is not correct.",
            "You can copy this address to the order address to speed up checkout.",
          ];
        case "place_order":
          return [
            "Order placed successfully — would you like to view the confirmation details?",
            "You can track your shipment or download the invoice from your orders page.",
            "Need help with anything else related to this order?",
          ];
        default:
          return [];
      }
    };

    console.log("----------------------result");
    console.log(result);
    

    return NextResponse.json({
      success: result.success,
      data: result.data ?? null,
      message: result.finalMessage,
      responseMessage: result.responseMessage ?? result.finalMessage,
      ...(intent === "suggest_products"
        ? {
            reason: result.reason ?? null,
            price: result.price ?? null,
            suggestedProduct: result.suggestedProduct ?? null,
            suggestedCapacity: result.suggestedCapacity ?? null,
          }
        : {}),
      intent,
      suggestions: buildSuggestions(intent, parsedData),
      clarificationNeeded: result.clarificationNeeded ?? null,
      tool: result.tool || "none",
      shoppingContext: result.shoppingContext,
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
