import { getLLMProvider } from "@/llm/llm.factory";

export type SupervisorAgent = "CatalogSearchAgent" | "CatalogSuggestAgent" | "CheckoutAgent" | "CartAgent" | "OrderAgent";

// NOTE: `udpate_shipping_address` intentionally keeps the requested spelling.
export type SupervisorUserIntent =
	| "search_product"
	| "suggest_product"
	| "product_detail"
	| "sku_detail"
	| "add_to_cart"
	| "view_cart"
	| "remove_cart"
	| "update_cart"
	| "proceed_to_checkout"
	| "set_client_profile"
	| "udpate_shipping_address"
	| "update_payment_method"
	| "place_order";

export interface SupervisorDecision {
	agentToInvoke: SupervisorAgent;
	userIntent: SupervisorUserIntent;
	userMessage: string;
}

const SUPERVISOR_PROMPT = `
You are a supervisor routing agent for an e-commerce assistant.

Task:
- Classify the user message into one userIntent.
- Pick which agent should handle it.

Allowed agentToInvoke values:
- CatalogSearchAgent
- CatalogSuggestAgent
- CheckoutAgent
- OrderAgent

Allowed userIntent values:
- search_product
- suggest_product
- product_detail
- sku_detail
- add_to_cart
- view_cart
- remove_cart
- update_cart
- proceed_to_checkout
- set_client_profile
- udpate_shipping_address
- update_payment_method
- place_order

Output format:
Return ONLY valid JSON with exactly these keys:
{
	"agentToInvoke": "catalog|checkout|order",
	"userIntent": "...one allowed value...",
	"userMessage": "...copy of the user message..."
}

Rules:
- If user asks for recommendations, use suggest_product.
- If user asks for SKU-level details, use sku_detail.
- If user asks to place/confirm/submit order, use place_order and order agent.
- If user asks checkout/profile/address/payment/cart operations, use checkout agent.
- For product search/browse/detail intent, use catalog agent.
- Never return markdown.
`;

const ALLOWED_AGENTS: SupervisorAgent[] = ["CatalogSearchAgent", "CatalogSuggestAgent", "CheckoutAgent", "CartAgent", "OrderAgent"];
const ALLOWED_INTENTS: SupervisorUserIntent[] = [
	"search_product",
	"suggest_product",
	"product_detail",
	"sku_detail",
	"add_to_cart",
	"view_cart",
	"remove_cart",
	"update_cart",
	"proceed_to_checkout",
	"set_client_profile",
	"udpate_shipping_address",
	"update_payment_method",
	"place_order",
];

const INTENT_AGENT_MAP: Record<SupervisorUserIntent, SupervisorAgent> = {
	search_product: "CatalogSearchAgent",
	suggest_product: "CatalogSuggestAgent",
	product_detail: "CatalogSearchAgent",
	sku_detail: "CatalogSearchAgent",
	add_to_cart: "CartAgent",
	view_cart: "CartAgent",
	remove_cart: "CartAgent",
	update_cart: "CartAgent",
	proceed_to_checkout: "CheckoutAgent",
	set_client_profile: "CheckoutAgent",
	udpate_shipping_address: "CheckoutAgent",
	update_payment_method: "CheckoutAgent",
	place_order: "OrderAgent",
};

export async function runSupervisorAgent(
	userMessage: string,
	context?: Record<string, unknown>,
): Promise<SupervisorDecision> {
	const providerOrder = getProviderOrder(process.env.LLM_PROVIDER || "groq");

	for (const providerName of providerOrder) {
		try {
			const llm = getLLMProvider(providerName);
			const rawResponse = await llm.generateResponse(
				buildSupervisorPrompt(userMessage, context),
			);
			const parsed = parseSupervisorResponse(rawResponse, userMessage);
			if (parsed) {
				return parsed;
			}
		} catch {
			// Continue to fallback providers or deterministic resolver.
		}
	}

	return resolveByRules(userMessage);
}

function buildSupervisorPrompt(
	userMessage: string,
	context?: Record<string, unknown>,
): string {
	return `${SUPERVISOR_PROMPT}

CONTEXT:
${JSON.stringify(context ?? {})}

USER_MESSAGE:
${userMessage}`;
}

function parseSupervisorResponse(
	rawResponse: string,
	userMessage: string,
): SupervisorDecision | null {
	try {
		const normalized = normalizeJsonPayload(rawResponse);
		const result = JSON.parse(normalized) as Partial<SupervisorDecision>;
		const normalizedIntent = normalizeIntent(result.userIntent);

		if (
			!result.agentToInvoke ||
			!normalizedIntent ||
			!ALLOWED_AGENTS.includes(result.agentToInvoke as SupervisorAgent) ||
			!ALLOWED_INTENTS.includes(normalizedIntent)
		) {
			return null;
		}

		const normalizedAgent = INTENT_AGENT_MAP[normalizedIntent];

		return {
			agentToInvoke: normalizedAgent,
			userIntent: normalizedIntent,
			userMessage: (result.userMessage || userMessage).trim(),
		};
	} catch {
		return null;
	}
}

function normalizeIntent(intent: unknown): SupervisorUserIntent | null {
	if (typeof intent !== "string") {
		return null;
	}

	if (intent === "update_shipping_address") {
		return "udpate_shipping_address";
	}

	if (ALLOWED_INTENTS.includes(intent as SupervisorUserIntent)) {
		return intent as SupervisorUserIntent;
	}

	return null;
}

function resolveByRules(userMessage: string): SupervisorDecision {
	const text = userMessage.toLowerCase();

	if (containsAny(text, ["place order", "submit order", "confirm order", "complete order", "buy now"])) {
		return {
			agentToInvoke: "CheckoutAgent",
			userIntent: "place_order",
			userMessage,
		};
	}

	if (containsAny(text, ["payment", "credit card", "debit card", "bank transfer", "upi", "paypal"])) {
		return {
			agentToInvoke: "CheckoutAgent",
			userIntent: "update_payment_method",
			userMessage,
		};
	}

	if (containsAny(text, ["shipping address", "delivery address", "ship to", "address change"])) {
		return {
			agentToInvoke: "CheckoutAgent",
			userIntent: "udpate_shipping_address",
			userMessage,
		};
	}

	if (containsAny(text, ["profile", "company details", "client profile", "billing info", "customer info"])) {
		return {
			agentToInvoke: "CheckoutAgent",
			userIntent: "set_client_profile",
			userMessage,
		};
	}

	if (containsAny(text, ["checkout", "proceed to checkout", "ready to checkout"])) {
		return {
			agentToInvoke: "CheckoutAgent",
			userIntent: "proceed_to_checkout",
			userMessage,
		};
	}

	if (containsAny(text, ["remove from cart", "delete from cart", "remove item"])) {
		return {
			agentToInvoke: "CartAgent",
			userIntent: "remove_cart",
			userMessage,
		};
	}

	if (containsAny(text, ["update cart", "change quantity", "increase quantity", "decrease quantity", "set quantity"])) {
		return {
			agentToInvoke: "CartAgent",
			userIntent: "update_cart",
			userMessage,
		};
	}

	if (containsAny(text, ["view cart", "show cart", "my cart", "cart items"])) {
		return {
			agentToInvoke: "CartAgent",
			userIntent: "view_cart",
			userMessage,
		};
	}

	if (containsAny(text, ["add to cart", "add this", "buy this", "add item"])) {
		return {
			agentToInvoke: "CartAgent",
			userIntent: "add_to_cart",
			userMessage,
		};
	}

	if (containsAny(text, ["sku", "variant", "size", "color option", "stock for"])) {
		return {
			agentToInvoke: "CatalogSearchAgent",
			userIntent: "sku_detail",
			userMessage,
		};
	}

	if (containsAny(text, ["suggest", "recommend", "best", "top picks"])) {
		return {
			agentToInvoke: "CatalogSuggestAgent",
			userIntent: "suggest_product",
			userMessage,
		};
	}

	if (containsAny(text, ["details", "specification", "spec", "warranty", "tell me about", "more about"])) {
		return {
			agentToInvoke: "CatalogSearchAgent",
			userIntent: "product_detail",
			userMessage,
		};
	}

	return {
		agentToInvoke: "CatalogSearchAgent",
		userIntent: "search_product",
		userMessage,
	};
}

function containsAny(text: string, keywords: string[]): boolean {
	return keywords.some((keyword) => text.includes(keyword));
}

function normalizeJsonPayload(rawResponse: string): string {
	const trimmed = rawResponse.trim();
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

	if (fenced?.[1]) {
		return fenced[1].trim();
	}

	const firstBrace = trimmed.indexOf("{");
	const lastBrace = trimmed.lastIndexOf("}");
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		return trimmed.slice(firstBrace, lastBrace + 1).trim();
	}

	return trimmed;
}

function getProviderOrder(primaryProvider: string): string[] {
	const fallbackProviders = (process.env.LLM_FALLBACK_PROVIDERS ?? "")
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);

	return dedupeProviders([primaryProvider.trim().toLowerCase(), ...fallbackProviders]);
}

function dedupeProviders(providers: string[]): string[] {
	return [...new Set(providers)];
}
