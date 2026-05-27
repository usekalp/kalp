import { KV_KEYS } from "@/shared/constants";
import { kvGetJson } from "./index";
import { readAgentIndex, readLatestHash } from "./agents";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

export interface HandlerLocationEntry {
  file: string;
  line: number;
  column: number;
  exportName: string;
  stableName: string;
  nodeId: string;
}

export interface SourceLocationEntry {
  file: string;
  line: number;
  column: number;
  handlerId: string;
  primitiveType: string;
}

export interface SourceMetadataManifest {
  schemaVersion: 1;
  primitiveLocations: Record<string, SourceLocationEntry>;
  handlerLocations: Record<string, HandlerLocationEntry>;
}

export async function readSourceMetadata(
  env: EnvWithKv,
  agentName: string,
  hash?: string,
): Promise<SourceMetadataManifest | null> {
  const indexed = await readAgentIndex(env);
  const indexedHash = (
    indexed.find((entry) => entry?.name === agentName) as
      | Record<string, unknown>
      | undefined
  )?.hash as string | undefined;
  const latestHash =
    hash ?? indexedHash ?? (await readLatestHash(env, agentName));
  if (!latestHash) return null;
  return kvGetJson<SourceMetadataManifest>(
    env,
    KV_KEYS.sourceMetadata(agentName, latestHash),
    null,
  );
}
