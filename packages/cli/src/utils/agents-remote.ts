import { join } from "node:path";
import { writeFile, rm } from "node:fs/promises";
import { resolveProvider } from "@/utils/providers";

export interface RemoteAgentIndexEntry {
  name: string;
  hash: string;
  version: string | null;
  versionNumber: number | null;
  updatedAt: string;
  workerUrl: string | null;
  label?: string;
  tags?: string[];
}

interface ManifestMetadata {
  name?: string;
  label?: string;
  tags?: string[];
}

export async function readRemoteAgentsIndex(
  cwd: string,
  wranglerConfigPath: string,
): Promise<RemoteAgentIndexEntry[]> {
  const provider = resolveProvider();
  const output = await provider
    .getValue({
      cwd,
      configPath: wranglerConfigPath,
      key: "agents:index",
    })
    .catch(() => null);
  if (!output) return [];
  try {
    const parsed = JSON.parse(output) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RemoteAgentIndexEntry[];
  } catch {
    return [];
  }
}

export async function writeRemoteAgentsIndex(
  cwd: string,
  wranglerConfigPath: string,
  entries: RemoteAgentIndexEntry[],
): Promise<void> {
  const path = join(cwd, ".kalp", "agents-index.json");
  await writeFile(path, JSON.stringify(entries, null, 2), "utf-8");
  const provider = resolveProvider();
  try {
    await provider.putManifest({
      cwd,
      configPath: wranglerConfigPath,
      key: "agents:index",
      jsonPath: path,
    });
  } finally {
    await rm(path, { force: true });
  }
}

export async function readRemoteAgentPointers(
  cwd: string,
  wranglerConfigPath: string,
): Promise<Array<{ name: string; hash: string }>> {
  const provider = resolveProvider();
  const keys = await provider.listKeys({
    cwd,
    configPath: wranglerConfigPath,
    prefix: "",
  });
  const latestKeys = keys
    .map((item) => item.name)
    .filter((key) => key.endsWith(":latest"));

  const pointers: Array<{ name: string; hash: string }> = [];
  for (const latestKey of latestKeys) {
    const name = latestKey.slice(0, -7);
    if (!name) continue;
    const hash = await provider
      .getValue({ cwd, configPath: wranglerConfigPath, key: latestKey })
      .catch(() => null);
    if (!hash) continue;
    pointers.push({ name, hash });
  }
  return pointers.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readRemoteManifestMetadata(params: {
  cwd: string;
  wranglerConfigPath: string;
  agentName: string;
  hash: string;
}): Promise<ManifestMetadata | null> {
  const provider = resolveProvider();
  const raw = await provider
    .getValue({
      cwd: params.cwd,
      configPath: params.wranglerConfigPath,
      key: `${params.agentName}:${params.hash}`,
    })
    .catch(() => null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { metadata?: ManifestMetadata };
    return parsed.metadata ?? null;
  } catch {
    return null;
  }
}
