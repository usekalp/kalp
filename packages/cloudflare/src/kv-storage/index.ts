import { safeJsonParse } from "@/shared/parse";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

export async function kvGetJson<T = unknown>(
  env: EnvWithKv,
  key: string,
  fallback: T | null = null,
): Promise<T | null> {
  const raw = await env.KALP_MANIFESTS.get(key);
  return safeJsonParse<T>(raw, fallback);
}

export async function kvPutJson(
  env: EnvWithKv,
  key: string,
  value: unknown,
): Promise<void> {
  await env.KALP_MANIFESTS.put(key, JSON.stringify(value));
}

export {
  readAgentIndex,
  readLatestHash,
  readSemanticIr,
  readSchemas,
  listAgentNamesFromKv,
} from "./agents";

export {
  readExecutionIndex,
  writeExecutionIndex,
  readExecutionSummary,
  writeExecutionSummary,
  readExecutionEvents,
  writeExecutionEvents,
} from "./executions";

export {
  readChatSessions,
  writeChatSessions,
  readChatMessages,
  writeChatMessages,
} from "./chat";

export {
  readSourceMetadata,
} from "./source-metadata";