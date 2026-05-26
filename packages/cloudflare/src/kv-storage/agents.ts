import { KV_KEYS } from "@/shared/constants";
import { kvGetJson } from "./index";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

export async function readAgentIndex(
  env: EnvWithKv,
): Promise<Array<Record<string, unknown>>> {
  const parsed = await kvGetJson<unknown[]>(env, KV_KEYS.agentsIndex, []);
  return (Array.isArray(parsed) ? parsed : []) as Array<Record<string, unknown>>;
}

export async function readLatestHash(
  env: EnvWithKv,
  agentName: string,
): Promise<string | null> {
  return env.KALP_MANIFESTS.get(KV_KEYS.latest(agentName));
}

export async function readSemanticIr(
  env: EnvWithKv,
  agentName: string,
  hash?: string,
): Promise<{ hash: string; semanticIr: Record<string, unknown> } | null> {
  const indexed = await readAgentIndex(env);
  const indexedHash = (
    indexed.find((entry) => entry?.name === agentName) as
      | Record<string, unknown>
      | undefined
  )?.hash as string | undefined;
  const latestHash =
    hash ?? indexedHash ?? (await readLatestHash(env, agentName));
  if (!latestHash) return null;
  const semanticIr = await kvGetJson<Record<string, unknown>>(
    env,
    KV_KEYS.semanticIr(agentName, latestHash),
    null,
  );
  return semanticIr ? { hash: latestHash, semanticIr } : null;
}

export async function readSchemas(
  env: EnvWithKv,
  agentName: string,
  hash?: string,
): Promise<{ hash: string; schemas: Record<string, unknown> } | null> {
  const indexed = await readAgentIndex(env);
  const indexedHash = (
    indexed.find((entry) => entry?.name === agentName) as
      | Record<string, unknown>
      | undefined
  )?.hash as string | undefined;
  const latestHash =
    hash ?? indexedHash ?? (await readLatestHash(env, agentName));
  if (!latestHash) return null;
  const schemas = await kvGetJson<Record<string, unknown>>(
    env,
    KV_KEYS.schemas(agentName, latestHash),
    null,
  );
  return schemas ? { hash: latestHash, schemas } : null;
}

export async function listAgentNamesFromKv(env: EnvWithKv): Promise<string[]> {
  const indexed = await readAgentIndex(env);
  if (indexed.length > 0) {
    return [
      ...new Set(
        indexed
          .map((entry) =>
            entry && typeof entry.name === "string" ? entry.name : "",
          )
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b));
  }

  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.KALP_MANIFESTS.list({ cursor, limit: 1000 });
    for (const item of listed.keys) {
      if (typeof item?.name !== "string") continue;
      if (!item.name.endsWith(":latest")) continue;
      names.push(item.name.slice(0, -7));
    }
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  return [...new Set(names)].sort((a, b) => a.localeCompare(b));
}