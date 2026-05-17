import { createHash } from "node:crypto";

export function hashJson(value: unknown): string {
  const stable = JSON.stringify(sortKeys(value));
  return createHash("sha256").update(stable).digest("hex").slice(0, 16);
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  return sorted;
}
