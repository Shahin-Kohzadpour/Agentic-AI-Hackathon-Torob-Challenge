import { NextRequest, NextResponse } from "next/server";
import { runShoppingAgent } from "@/lib/agent/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, userLocation } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages array" }, { status: 400 });
    }

    const result = await runShoppingAgent(messages, userLocation);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: String(error) },
      { status: 500 }
    );
  }
}
