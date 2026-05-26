export const SESSION_COOKIE_NAME = "kalp_studio_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const KV_KEYS = {
  agentsIndex: "agents:index",
  executionIndex(agentName: string): string {
    return `runtime:executions:${agentName}:index`;
  },
  executionSummary(agentName: string, executionId: string): string {
    return `runtime:execution:${agentName}:${executionId}:summary`;
  },
  executionEvents(agentName: string, executionId: string): string {
    return `runtime:execution:${agentName}:${executionId}:events`;
  },
  chatSessions(agentName: string): string {
    return `runtime:chat:${agentName}:sessions`;
  },
  chatMessages(agentName: string, sessionId: string): string {
    return `runtime:chat:${agentName}:${sessionId}:messages`;
  },
  latest(agentName: string): string {
    return `${agentName}:latest`;
  },
  semanticIr(agentName: string, hash: string): string {
    return `${agentName}:${hash}:semantic-ir`;
  },
  schemas(agentName: string, hash: string): string {
    return `${agentName}:${hash}:schemas`;
  },
};
