import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/runAgent";

async function handler() {
  try {
    const summary = await runAgent();
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("[ingest] runAgent failed", error);
    return NextResponse.json({ success: false, error: "Agent failed" }, { status: 500 });
  }
}

// POST — triggered by the UI refresh button.
export const POST = handler;
