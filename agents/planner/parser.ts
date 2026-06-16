import { PlannerPlan, ToolCallResult } from "../types/type";

export function parsePlan(rawResponse: string) {
    console.log("--------------------rawResponse");
    console.log(rawResponse);

    try {
        const normalized = normalizeJsonPayload(rawResponse);
        const plan: PlannerPlan = JSON.parse(normalized);
        // Basic validation of the plan structure
        if (!plan.steps || !Array.isArray(plan.steps)) {
            throw new Error("Invalid plan format: 'steps' field is missing or not an array.");
        }
        return plan;
    } catch (error) {
        console.error("Failed to parse planner response:", error);
        throw new Error("Unable to parse the planner's response. Please ensure it follows the expected format.");
    }
}

export function parseToolCall(rawResponse: string): ToolCallResult {
    try {
        const normalized = normalizeJsonPayload(rawResponse);
        const result: ToolCallResult = JSON.parse(normalized);

        if (!result.tool) {
            throw new Error("Invalid tool call format: 'tool' field is missing.");
        }

        return result;
    } catch (error) {
        console.error("Failed to parse tool call response:", error);
        return {
            tool: "none",
            action: "no_action",
            shouldInvokeTool: false,
            nextAction: null,
            parameters: {},
            confidence: 0,
            reasoning: "Failed to parse LLM response",
            response_message: "I'm sorry, I couldn't understand that. Could you please rephrase?",
        };
    }
}

function normalizeJsonPayload(rawResponse: string): string {
    const trimmed = rawResponse.trim();

    // Handle markdown fenced payloads: ```json ... ```
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        return fenced[1].trim();
    }

    // Handle mixed text around JSON by extracting the outermost object
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return trimmed.slice(firstBrace, lastBrace + 1).trim();
    }

    return trimmed;
}