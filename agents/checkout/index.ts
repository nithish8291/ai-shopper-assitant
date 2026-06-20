import { getLLMProvider } from "@/llm/llm.factory";
import { buildCheckoutPrompt, buildCartPrompt } from "../prompts";
import { formatError, getProviderOrder } from "../utils/provider";
import { ToolCallResult } from "../types/type";
import { parseToolCall } from "../utils/parser";


export async function CheckoutAgent(
  userInput: string,
  context?: Record<string, unknown>
): Promise<ToolCallResult> {
  const prompt = buildCheckoutPrompt(userInput, context);
  const providerOrder = getProviderOrder(process.env.LLM_PROVIDER || "groq");
  const failures: string[] = [];

  for (const providerName of providerOrder) {
    try {
      const llm = getLLMProvider(providerName);
      const rawResponse = await llm.generateResponse(prompt);
      return parseToolCall(rawResponse);
    } catch (error) {
      failures.push(`${providerName}: ${formatError(error)}`);
    }
  }

  throw new Error(
    `Checkout agent failed for all configured providers (${providerOrder.join(", ")}). ${failures.join(" | ")}`
  );
}

export async function CartAgent(
  userInput: string,
  context?: Record<string, unknown>
): Promise<ToolCallResult> {
  const prompt = buildCartPrompt(userInput, context);
  const providerOrder = getProviderOrder(process.env.LLM_PROVIDER || "groq");
  const failures: string[] = [];
  for (const providerName of providerOrder) {
    try {
      const llm = getLLMProvider(providerName);
      const rawResponse = await llm.generateResponse(prompt);
      return parseToolCall(rawResponse);
    } catch (error) {
      failures.push(`${providerName}: ${formatError(error)}`);
    }
  }

  throw new Error(
    `Cart agent failed for all configured providers (${providerOrder.join(", ")}). ${failures.join(" | ")}`
  );
}