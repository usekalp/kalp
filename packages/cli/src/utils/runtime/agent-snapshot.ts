import { readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deriveLabelFromName } from "@kalphq/project";
import { readAgentManifest } from "@/utils/manifest";
import { readProjectState } from "@/utils/project-state";

export interface RuntimeAgentRecord {
  name: string;
  label?: string;
  tags?: string[];
  description?: string;
  environment: "local" | "remote" | "both";
  status: "online" | "offline";
  hash: string | null;
  version: string | null;
  versionNumber: number | null;
  lastRemoteHash: string | null;
  lastLocalHash: string | null;
  workerUrl: string | null;
  localPath: string | null;
  updatedAt: string | null;
}

export interface LocalAgentMetadata {
  label?: string;
  description?: string;
  tags?: string[];
}

export interface RuntimeAgentsSnapshot {
  generatedAt: string;
  projectPath: string;
  workerUrl: string | null;
  mode: "local" | "remote";
  agents: RuntimeAgentRecord[];
}

async function readLocalAgentMetadata(
  cwd: string,
  agentName: string,
): Promise<LocalAgentMetadata | null> {
  try {
    const manifest = await readAgentManifest({ cwd, agentName });
    return {
      label: manifest.semanticIr.agent?.label,
      description: manifest.semanticIr.agent?.description,
      tags: manifest.semanticIr.agent?.tags,
    };
  } catch {
    return null;
  }
}

export async function readLocalAgentNames(cwd: string): Promise<string[]> {
  const agentsDir = join(cwd, "agents");
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    const names: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const indexPath = join(agentsDir, entry.name, "index.ts");
      const exists = await stat(indexPath)
        .then(() => true)
        .catch(() => false);
      if (exists) names.push(entry.name);
    }
    return names.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function createAgentsSnapshot(
  cwd: string,
  mode: "local" | "remote",
): Promise<RuntimeAgentsSnapshot> {
  const localAgentNames = await readLocalAgentNames(cwd);
  const state = await readProjectState(cwd);

  const byName = new Map<string, RuntimeAgentRecord>();
  const stateAgents = state?.agents ?? {};

  for (const name of localAgentNames) {
    const localPath = join(cwd, "agents", name, "index.ts");
    const saved = stateAgents[name];
    const localMetadata = await readLocalAgentMetadata(cwd, name);
    const hasRemoteVersion = !!saved?.lastRemoteHash && (saved?.currentVersion ?? 0) > 0;

    if (mode === "remote" && !hasRemoteVersion) {
      continue;
    }

    const resolvedWorkerUrl =
      saved?.workerUrl ??
      (state?.workerUrl ? `${state.workerUrl.replace(/\/$/, "")}/a/${name}` : null);
    const versionNumber =
      typeof saved?.currentVersion === "number" && saved.currentVersion > 0
        ? saved.currentVersion
        : null;

    byName.set(name, {
      name,
      label: localMetadata?.label ?? deriveLabelFromName(name),
      description: localMetadata?.description,
      tags: localMetadata?.tags ?? [],
      environment:
        mode === "remote"
          ? "remote"
          : hasRemoteVersion
            ? "both"
            : "local",
      status: resolvedWorkerUrl ? "online" : "offline",
      hash: saved?.currentHash ?? null,
      version: versionNumber ? `v${versionNumber}` : null,
      versionNumber,
      lastRemoteHash: saved?.lastRemoteHash ?? null,
      lastLocalHash: saved?.lastLocalHash ?? null,
      workerUrl: resolvedWorkerUrl,
      localPath,
      updatedAt: saved?.lastPushedAt ?? state?.deployedAt ?? null,
    });
  }

  if (mode === "remote") {
    for (const [name, saved] of Object.entries(stateAgents)) {
      const hasRemoteVersion =
        !!saved.lastRemoteHash && (saved.currentVersion ?? 0) > 0;
      if (!hasRemoteVersion || byName.has(name)) continue;

      const localPath = saved.localPath ?? join(cwd, "agents", name, "index.ts");
      const workerUrl =
        saved.workerUrl ??
        (state?.workerUrl ? `${state.workerUrl.replace(/\/$/, "")}/a/${name}` : null);
      const versionNumber = saved.currentVersion > 0 ? saved.currentVersion : null;

      byName.set(name, {
        name,
        label: deriveLabelFromName(name),
        tags: [],
        environment: "remote",
        status: workerUrl ? "online" : "offline",
        hash: saved.currentHash ?? null,
        version: versionNumber ? `v${versionNumber}` : null,
        versionNumber,
        lastRemoteHash: saved.lastRemoteHash ?? null,
        lastLocalHash: saved.lastLocalHash ?? null,
        workerUrl,
        localPath,
        updatedAt: saved.lastPushedAt ?? state?.deployedAt ?? null,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    projectPath: cwd,
    workerUrl: state?.workerUrl ?? null,
    mode,
    agents: Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function writeRuntimeAgentsSnapshot(params: {
  cwd: string;
  runtimeDir: string;
  mode: "local" | "remote";
}): Promise<void> {
  const snapshot = await createAgentsSnapshot(params.cwd, params.mode);
  await writeFile(
    join(params.runtimeDir, "agents.snapshot.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf-8",
  );
}
