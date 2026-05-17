import { CORS_HEADERS } from "./constants.js";

export function extractBearerToken(authorization) {
  if (!authorization) return null;
  const value = authorization.trim();
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) return null;
  const token = match[1].trim();
  return token || null;
}

export function normalizeHeaderRecord(request) {
  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }
  return headers;
}

export function withCors(response) {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toIsoDate(value) {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function summarizeValue(value) {
  if (value == null) return "null";
  if (typeof value === "string") return value.slice(0, 280);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === "object") return `object(${Object.keys(value).length})`;
  return typeof value;
}

export function inferTextFromAgentResponse(payload) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return JSON.stringify(payload);
  if (typeof payload.text === "string") return payload.text;
  if (payload.result && typeof payload.result === "object") {
    if (typeof payload.result.text === "string") return payload.result.text;
    if (typeof payload.result.summary === "string") return payload.result.summary;
  }
  return JSON.stringify(payload);
}

export function makeId(prefix) {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${random}`;
}
