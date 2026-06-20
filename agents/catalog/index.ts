import { getLLMProvider } from "@/llm/llm.factory";
import { buildCartAnswerPrompt, buildCatalogPrompt, buildCatalogSuggestPrompt, buildProductAnswerPrompt } from "../prompts";
import { formatError, getProviderOrder } from "../utils/provider";
import { ToolCallResult } from "../types/type";
import { parseToolCall } from "../utils/parser";
import { Product } from "@/lib/shopping-memory";


export async function CatalogSearchAgent(
  userInput: string,
  context?: Record<string, unknown>
): Promise<ToolCallResult> {
  const prompt = buildCatalogPrompt(userInput, context);
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
    `Catalog search agent failed for all configured providers (${providerOrder.join(", ")}). ${failures.join(" | ")}`
  );
}

export async function CatalogSuggestAgent(
  userInput: string,
): Promise<ToolCallResult> {
  const prompt = buildCatalogSuggestPrompt(userInput);
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
    `Catalog suggest agent failed for all configured providers (${providerOrder.join(", ")}). ${failures.join(" | ")}`
  );
}

export async function generateProductAnswerAgent(
  userInput: string,
  product: Product
): Promise<any> {
  const prompt = buildProductAnswerPrompt(userInput, product);
  const providerOrder = getProviderOrder(process.env.LLM_PROVIDER || "groq");
  const failures: string[] = [];
  for (const providerName of providerOrder) {
    try {
      const llm = getLLMProvider(providerName);
      const rawResponse = await llm.generateResponse(prompt);
      return rawResponse;
    } catch (error) {
      failures.push(`${providerName}: ${formatError(error)}`);
    }
  }

  throw new Error(
    `Product answer agent failed for all configured providers (${providerOrder.join(", ")}). ${failures.join(" | ")}`
  );
}


export async function generateCartAnswerAgent(
  userInput: string,
  cart: any
): Promise<any> {
  const prompt = buildCartAnswerPrompt(userInput, cart);
  const providerOrder = getProviderOrder(process.env.LLM_PROVIDER || "groq");
  const failures: string[] = [];
  for (const providerName of providerOrder) {
    try {
      const llm = getLLMProvider(providerName);
      const rawResponse = await llm.generateResponse(prompt);
      return rawResponse;
    } catch (error) {
      failures.push(`${providerName}: ${formatError(error)}`);
    }
  }

  throw new Error(
    `Cart answer agent failed for all configured providers (${providerOrder.join(", ")}). ${failures.join(" | ")}`
  );
}