import type { PersistenceAdapter, EffectMap } from "@kalphq/core";

export async function resolveMemoryAppend(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["memory.append"]["result"]> {
  if (!persistence) return undefined as EffectMap["memory.append"]["result"];
  const { key, content, role, metadata } = payload as {
    key?: string;
    content: string;
    role?: string;
    metadata?: Record<string, unknown>;
  };
  const memoryKey = `__kalp_memory__${key ?? "default"}`;
  const existing = (await persistence.state.get(memoryKey)) as Array<unknown> | null;
  const messages = Array.isArray(existing) ? existing : [];
  messages.push({
    role: role ?? "user",
    content,
    ...(metadata ? { metadata } : {}),
    timestamp: new Date().toISOString(),
  });
  await persistence.state.set(memoryKey, messages);
  return undefined as EffectMap["memory.append"]["result"];
}

export async function resolveMemoryList(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["memory.list"]["result"]> {
  if (!persistence) return { items: [], nextCursor: undefined } as EffectMap["memory.list"]["result"];
  const { key, limit, cursor } = payload as {
    key?: string;
    limit?: number;
    cursor?: string;
  };
  const memoryKey = `__kalp_memory__${key ?? "default"}`;
  const raw = (await persistence.state.get(memoryKey)) as Array<unknown> | null;
  const allMessages = Array.isArray(raw) ? raw : [];
  const start = cursor ? parseInt(cursor, 10) : 0;
  const effectiveLimit = limit ?? 50;
  const sliced = allMessages.slice(start, start + effectiveLimit);
  const nextCursor = start + effectiveLimit < allMessages.length
    ? String(start + effectiveLimit)
    : undefined;
  return { items: sliced, nextCursor } as EffectMap["memory.list"]["result"];
}

export async function resolveMemorySummarize(
  payload: Record<string, unknown>,
  persistence: PersistenceAdapter | undefined,
): Promise<EffectMap["memory.summarize"]["result"]> {
  if (!persistence) return "" as EffectMap["memory.summarize"]["result"];
  const { key } = payload as { key?: string };
  const memoryKey = `__kalp_memory__${key ?? "default"}`;
  const raw = (await persistence.state.get(memoryKey)) as Array<{ content?: string; role?: string }> | null;
  const messages = Array.isArray(raw) ? raw : [];
  if (messages.length === 0) return "" as EffectMap["memory.summarize"]["result"];
  return messages.map((m) => `${m.role ?? "unknown"}: ${m.content ?? ""}`).join("\n") as EffectMap["memory.summarize"]["result"];
}