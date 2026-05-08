import { NextResponse } from "next/server";
import { getAgentHash } from "@/lib/agent-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ agentName: string }> },
) {
  const { agentName } = await params;
  const hash = getAgentHash(agentName);

  if (hash === null) {
    return NextResponse.json({
      agentName,
      exists: false,
    });
  }

  return NextResponse.json({
    agentName,
    hash,
    exists: true,
  });
}
