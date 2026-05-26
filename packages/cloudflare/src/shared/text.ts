export function toIsoDate(value: string | number | Date): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

export function summarizeValue(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return value.slice(0, 280);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === "object") return `object(${Object.keys(value as Record<string, unknown>).length})`;
  return typeof value;
}

export function inferTextFromAgentResponse(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return JSON.stringify(payload);
  const obj = payload as Record<string, unknown>;
  if (typeof obj.text === "string") return obj.text;
  if (obj.result && typeof obj.result === "object") {
    const result = obj.result as Record<string, unknown>;
    if (typeof result.text === "string") return result.text;
    if (typeof result.summary === "string") return result.summary;
  }
  return JSON.stringify(payload);
}