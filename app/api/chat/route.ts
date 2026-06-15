import { NextRequest, NextResponse } from "next/server";
import { executeLoop } from "@/agents/executor/index";

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Use sessionId from client or generate a default
    const resolvedSessionId = sessionId || "default-session";

    // Run the multi-step execution loop with persistent shopping memory
    const result = await executeLoop(resolvedSessionId, message);

    return NextResponse.json({
      success: result.success,
      data: result.data ?? null,
      message: result.finalMessage,
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
