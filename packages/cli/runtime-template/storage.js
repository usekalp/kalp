import { KV_KEYS } from "./constants.js";
import { safeJsonParse } from "./shared.js";

export async function kvGetJson(env, key, fallback = null) {
  const raw = await env.KALP_MANIFESTS.get(key);
  return safeJsonParse(raw, fallback);
}

export async function kvPutJson(env, key, value) {
  await env.KALP_MANIFESTS.put(key, JSON.stringify(value));
}

export async function readAgentIndex(env) {
  const parsed = await kvGetJson(env, KV_KEYS.agentsIndex, []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function readLatestHash(env, agentName) {
  return env.KALP_MANIFESTS.get(KV_KEYS.latest(agentName));
}

export async function readSemanticIr(env, agentName, hash) {
  const indexed = await readAgentIndex(env);
  const indexedHash =
    indexed.find((entry) => entry?.name === agentName)?.hash ?? undefined;
  const latestHash = hash ?? indexedHash ?? (await readLatestHash(env, agentName));
  if (!latestHash) return null;
  const semanticIr = await kvGetJson(
    env,
    KV_KEYS.semanticIr(agentName, latestHash),
    null,
  );
  return semanticIr ? { hash: latestHash, semanticIr } : null;
}

export async function readSchemas(env, agentName, hash) {
  const indexed = await readAgentIndex(env);
  const indexedHash =
    indexed.find((entry) => entry?.name === agentName)?.hash ?? undefined;
  const latestHash = hash ?? indexedHash ?? (await readLatestHash(env, agentName));
  if (!latestHash) return null;
  const schemas = await kvGetJson(
    env,
    KV_KEYS.schemas(agentName, latestHash),
    null,
  );
  return schemas ? { hash: latestHash, schemas } : null;
}

export async function listAgentNamesFromKv(env) {
  const indexed = await readAgentIndex(env);
  if (indexed.length > 0) {
    return [
      ...new Set(
        indexed
          .map((entry) => (entry && typeof entry.name === "string" ? entry.name : ""))
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }

  const names = [];
  let cursor = undefined;
  do {
    const listed = await env.KALP_MANIFESTS.list({ cursor, limit: 1_000 });
    for (const item of listed.keys) {
      if (typeof item?.name !== "string") continue;
      if (!item.name.endsWith(":latest")) continue;
      names.push(item.name.slice(0, -7));
    }
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}

export async function readExecutionIndex(env, agentName) {
  const parsed = await kvGetJson(env, KV_KEYS.executionIndex(agentName), []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeExecutionIndex(env, agentName, entries) {
  await kvPutJson(env, KV_KEYS.executionIndex(agentName), entries);
}

export async function readExecutionSummary(env, agentName, executionId) {
  return kvGetJson(env, KV_KEYS.executionSummary(agentName, executionId), null);
}

export async function writeExecutionSummary(env, agentName, executionId, summary) {
  await kvPutJson(env, KV_KEYS.executionSummary(agentName, executionId), summary);
}

export async function readExecutionEvents(env, agentName, executionId) {
  const parsed = await kvGetJson(
    env,
    KV_KEYS.executionEvents(agentName, executionId),
    [],
  );
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeExecutionEvents(env, agentName, executionId, events) {
  await kvPutJson(env, KV_KEYS.executionEvents(agentName, executionId), events);
}

export async function readChatSessions(env, agentName) {
  const parsed = await kvGetJson(env, KV_KEYS.chatSessions(agentName), []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeChatSessions(env, agentName, sessions) {
  await kvPutJson(env, KV_KEYS.chatSessions(agentName), sessions);
}

export async function readChatMessages(env, agentName, sessionId) {
  const parsed = await kvGetJson(
    env,
    KV_KEYS.chatMessages(agentName, sessionId),
    [],
  );
  return Array.isArray(parsed) ? parsed : [];
}

export async function writeChatMessages(env, agentName, sessionId, messages) {
  await kvPutJson(env, KV_KEYS.chatMessages(agentName, sessionId), messages);
}
