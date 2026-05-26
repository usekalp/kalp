export { withCors } from "./cors";
export { makeId } from "./ids";
export { extractBearerToken, safeJsonParse } from "./parse";
export { toIsoDate, summarizeValue, inferTextFromAgentResponse } from "./text";
export { CORS_HEADERS, KV_KEYS } from "./constants";

export function normalizeHeaderRecord(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }
  return headers;
}