import { NextRequest, NextResponse } from "next/server";
import { executeLoop } from "@/agents/executor/index";

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, context } = await req.json();
    
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Use sessionId from client, or fall back to a default
    const resolvedSessionId = sessionId || context?.sessionId;
    // Run the multi-step execution loop with persistent shopping memory
    const result = await executeLoop(resolvedSessionId, message);

    console.log("---------------------result");
    console.log(JSON.stringify(result,null,2));
    
    // Determine the primary intent from the last executed tool step
    const lastToolStep = [...result.steps].reverse().find((s) => s.tool);
    const intent = lastToolStep?.tool || "none";

    return NextResponse.json({
      success: result.success,
      data: result.data ?? null,
      message: result.finalMessage,
      intent,
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
