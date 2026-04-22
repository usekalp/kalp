import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { agentName, ir, hash } = body;

  console.log("📦 PUSH RECEIVED");
  console.log("agent:", agentName);
  console.log("hash:", hash);
  console.log("ir:", JSON.stringify(ir, null, 2));

  // Phase 1: Just log
  // Phase 2: Store in database
  // Phase 3: Manage state, rollback, etc

  return NextResponse.json({
    ok: true,
    received: true,
    agentName,
    hash: hash.slice(0, 16),
  });
}
