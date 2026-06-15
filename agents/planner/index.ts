import { getLLMProvider } from "../../llm/llm.factory";
import { PlannerPlan, ToolCallResult } from "../types/type";
import { parsePlan, parseToolCall } from "./parser";
import { buildPlannerPrompt } from "./prompt";


export async function runPlannerAgent(
  userInput: string
): Promise<PlannerPlan> {
  const prompt = buildPlannerPrompt(userInput);
  const providerOrder = getProviderOrder(process.env.LLM_PROVIDER || "groq");
  const failures: string[] = [];

  for (const providerName of providerOrder) {
    try {
      const llm = getLLMProvider(providerName);
      const rawResponse = await llm.generateResponse(prompt);
      return parsePlan(rawResponse);
    } catch (error) {
      failures.push(`${providerName}: ${formatError(error)}`);
    }
  }

  throw new Error(
    `Planner agent failed for all configured providers (${providerOrder.join(", ")}). ${failures.join(" | ")}`
  );
}

export async function runIntentAgent(
  userInput: string,
  context?: Record<string, unknown>
): Promise<ToolCallResult> {
  const prompt = buildPlannerPrompt(userInput, context);
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
    `Intent agent failed for all configured providers (${providerOrder.join(", ")}). ${failures.join(" | ")}`
  );
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

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
