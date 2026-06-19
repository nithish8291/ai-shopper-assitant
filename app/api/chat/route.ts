import { NextRequest, NextResponse } from "next/server";
import { executeLoop } from "@/agents/executor/index";

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
    // Run the multi-step execution loop with persistent shopping memory
    const result = await executeLoop(resolvedSessionId, message, customerData);
    
    // Determine the primary intent from the last executed tool step
    const lastToolStep = [...result.steps].reverse().find((s) => s.tool);
    const intent = lastToolStep?.tool || "none";

    const buildSuggestions = (intentName: string) => {
      switch (intentName) {
        case "search_products":
          return [
            "I found several matching products — would you like to view details for any of them?",
            "You can add a product to your cart directly from the listing.",
            "Try refining your search with a different keyword or filter to get better results.",
          ];
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
        case "get_cart":
          return [
            "This is your current cart — you can update item quantities or remove items.",
            "When you're ready, proceed to checkout to enter shipping and payment details.",
            "You can also apply a coupon code or estimate shipping costs.",
            "You can add items to your cart"
          ];
        case "update_item_in_cart":
          return [
            "Item updated — would you like to view your cart now?",
            "Proceed to checkout when you're ready to complete the purchase.",
            "Continue shopping to add more items to your cart.",
          ];
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
      intent,
      suggestions: buildSuggestions(intent),
      clarificationNeeded: result.clarificationNeeded ?? null,
      steps: result.steps.map((s) => ({
        tool: s.tool,
        message: s.message,
      })),
      shoppingContext: result.shoppingContext,
    });
  } catch (error: unknown) {
    console.error("Chat API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
