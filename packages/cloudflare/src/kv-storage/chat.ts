import { KV_KEYS } from "@/shared/constants";
import { kvGetJson, kvPutJson } from "./index";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

export async function readChatSessions<T = Record<string, unknown>>(
  env: EnvWithKv,
  agentName: string,
): Promise<T[]> {
  const parsed = await kvGetJson<T[]>(env, KV_KEYS.chatSessions(agentName), []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeChatSessions(
  env: EnvWithKv,
  agentName: string,
  sessions: unknown[],
): Promise<void> {
  await kvPutJson(env, KV_KEYS.chatSessions(agentName), sessions);
}

export async function readChatMessages<T = Record<string, unknown>>(
  env: EnvWithKv,
  agentName: string,
  sessionId: string,
): Promise<T[]> {
  const parsed = await kvGetJson<T[]>(
    env,
    KV_KEYS.chatMessages(agentName, sessionId),
    [],
  );
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeChatMessages(
  env: EnvWithKv,
  agentName: string,
  sessionId: string,
  messages: unknown[],
): Promise<void> {
  await kvPutJson(env, KV_KEYS.chatMessages(agentName, sessionId), messages);
}