import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
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

export interface PruneResult {
  removedAgents: string[];
  deletedKeys: number;
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

export async function pruneStaleRemoteAgents(params: {
  cwd: string;
  wranglerConfigPath: string;
  remoteEntries: RemoteAgentIndexEntry[];
  localAgentNames: string[];
}): Promise<PruneResult> {
  const { cwd, wranglerConfigPath, remoteEntries, localAgentNames } = params;
  const localSet = new Set(localAgentNames);
  const staleEntries = remoteEntries.filter(
    (entry) => !localSet.has(entry.name),
  );

  if (staleEntries.length === 0) {
    return { removedAgents: [], deletedKeys: 0 };
  }

  const preview = staleEntries
    .slice(0, 3)
    .map((entry) => entry.name)
    .join(", ");
  const suffix =
    staleEntries.length > 3 ? ` and ${staleEntries.length - 3} more` : "";
  const confirmation = await p.confirm({
    message: `Found ${staleEntries.length} stale remote agents that no longer exist locally (e.g., ${pc.cyan(preview)}${suffix}). Do you want to prune them from the remote runtime?`,
    initialValue: true,
  });

  if (p.isCancel(confirmation)) {
    p.outro("Cancelled");
    process.exit(0);
  }

  if (!confirmation) {
    return { removedAgents: [], deletedKeys: 0 };
  }

  const provider = resolveProvider();
  let deletedKeys = 0;

  for (const entry of staleEntries) {
    const latestKey = `${entry.name}:latest`;
    const latestHash = await provider
      .getValue({ cwd, configPath: wranglerConfigPath, key: latestKey })
      .catch(() => null);

    const hashes = new Set<string>();
    if (entry.hash) hashes.add(entry.hash);
    if (latestHash) hashes.add(latestHash);

    const latestDeleted = await provider
      .deleteValue({
        cwd,
        configPath: wranglerConfigPath,
        key: latestKey,
      })
      .then(() => true)
      .catch(() => false);
    if (latestDeleted) deletedKeys += 1;

    for (const hash of hashes) {
      const artifactKeys = await provider
        .listKeys({
          cwd,
          configPath: wranglerConfigPath,
          prefix: `${entry.name}:${hash}:`,
        })
        .catch(() => []);

      for (const artifactKey of artifactKeys) {
        const deleted = await provider
          .deleteValue({
            cwd,
            configPath: wranglerConfigPath,
            key: artifactKey.name,
          })
          .then(() => true)
          .catch(() => false);
        if (deleted) deletedKeys += 1;
      }
    }
  }

  const filtered = remoteEntries.filter((entry) => localSet.has(entry.name));
  await writeRemoteAgentsIndex(cwd, wranglerConfigPath, filtered);

  return {
    removedAgents: staleEntries
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b)),
    deletedKeys,
  };
}
