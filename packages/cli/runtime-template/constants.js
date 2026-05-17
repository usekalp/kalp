export const SESSION_COOKIE_NAME = "kalp_studio_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const KV_KEYS = {
  agentsIndex: "agents:index",
  executionIndex(agentName) {
    return `runtime:executions:${agentName}:index`;
  },
  executionSummary(agentName, executionId) {
    return `runtime:execution:${agentName}:${executionId}:summary`;
  },
  executionEvents(agentName, executionId) {
    return `runtime:execution:${agentName}:${executionId}:events`;
  },
  chatSessions(agentName) {
    return `runtime:chat:${agentName}:sessions`;
  },
  chatMessages(agentName, sessionId) {
    return `runtime:chat:${agentName}:${sessionId}:messages`;
  },
  latest(agentName) {
    return `${agentName}:latest`;
  },
  semanticIr(agentName, hash) {
    return `${agentName}:${hash}:semantic-ir`;
  },
  schemas(agentName, hash) {
    return `${agentName}:${hash}:schemas`;
  },
};
