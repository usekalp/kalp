import { KV_KEYS } from "@/shared/constants";
import { kvGetJson, kvPutJson } from "./index";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

export async function readExecutionIndex(
  env: EnvWithKv,
  agentName: string,
): Promise<string[]> {
  const parsed = await kvGetJson<unknown[]>(
    env,
    KV_KEYS.executionIndex(agentName),
    [],
  );
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

export async function writeExecutionIndex(
  env: EnvWithKv,
  agentName: string,
  entries: string[],
): Promise<void> {
  await kvPutJson(env, KV_KEYS.executionIndex(agentName), entries);
}

export async function readExecutionSummary<T = Record<string, unknown>>(
  env: EnvWithKv,
  agentName: string,
  executionId: string,
): Promise<T | null> {
  return kvGetJson<T>(
    env,
    KV_KEYS.executionSummary(agentName, executionId),
    null,
  );
}

export async function writeExecutionSummary(
  env: EnvWithKv,
  agentName: string,
  executionId: string,
  summary: unknown,
): Promise<void> {
  await kvPutJson(
    env,
    KV_KEYS.executionSummary(agentName, executionId),
    summary,
  );
}

export async function readExecutionEvents<T = Record<string, unknown>>(
  env: EnvWithKv,
  agentName: string,
  executionId: string,
): Promise<T[]> {
  const parsed = await kvGetJson<T[]>(
    env,
    KV_KEYS.executionEvents(agentName, executionId),
    [],
  );
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeExecutionEvents(
  env: EnvWithKv,
  agentName: string,
  executionId: string,
  events: unknown[],
): Promise<void> {
  await kvPutJson(env, KV_KEYS.executionEvents(agentName, executionId), events);
}