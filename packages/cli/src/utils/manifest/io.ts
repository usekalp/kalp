import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ManifestVersionRecord, ManifestRegistryEntry } from "./types";
import { createVersionId, getManifestHash } from "./hash";
import type { AgentManifestV1 } from "./types";

function isManifestVersionFile(fileName: string): boolean {
  return fileName.endsWith(".json");
}

async function readManifestVersionFile(
  filePath: string,
): Promise<ManifestVersionRecord | null> {
  try {
    const src = await readFile(filePath, "utf-8");
    return JSON.parse(src) as ManifestVersionRecord;
  } catch {
    return null;
  }
}

async function readSnapshot(
  snapshotPath: string,
): Promise<Record<string, ManifestRegistryEntry>> {
  try {
    const src = await readFile(snapshotPath, "utf-8");
    return JSON.parse(src) as Record<string, ManifestRegistryEntry>;
  } catch {
    return {};
  }
}

export async function writeVersionedManifest(params: {
  cwd: string;
  agentName: string;
  manifest: AgentManifestV1;
}): Promise<ManifestVersionRecord & { outputPath: string }> {
  const { cwd, agentName, manifest } = params;
  const agentMetaDir = join(cwd, "meta", "migrations", agentName);
  await mkdir(agentMetaDir, { recursive: true });

  const files = await readdir(agentMetaDir);
  const versionFiles = files.filter(isManifestVersionFile);
  const existingRecords = (
    await Promise.all(
      versionFiles.map((file) =>
        readManifestVersionFile(join(agentMetaDir, file)),
      ),
    )
  ).filter((record): record is ManifestVersionRecord => record !== null);

  const latestVersion =
    existingRecords
      .map((record) => record.version)
      .sort((a, b) => a - b)
      .at(-1) ?? 0;
  const nextVersion = latestVersion + 1;

  const generatedAt = new Date().toISOString();
  const versionId = createVersionId(nextVersion);
  const record: ManifestVersionRecord = {
    version: nextVersion,
    versionId,
    hash: getManifestHash(manifest),
    generatedAt,
    immutable: true,
    manifest,
  };

  const versionFile = join(agentMetaDir, `${versionId}.json`);
  await writeFile(versionFile, JSON.stringify(record, null, 2) + "\n", "utf-8");

  const snapshotPath = join(cwd, "meta", "snapshot.json");
  const snapshot = await readSnapshot(snapshotPath);
  const prev = snapshot[agentName] ?? { latest: "", versions: [] };
  const versions = prev.versions.includes(versionId)
    ? prev.versions
    : [...prev.versions, versionId];
  snapshot[agentName] = { latest: versionId, versions };
  await writeFile(
    snapshotPath,
    JSON.stringify(snapshot, null, 2) + "\n",
    "utf-8",
  );

  return {
    ...record,
    outputPath: versionFile,
  };
}

export async function readLatestVersionedManifest(params: {
  cwd: string;
  agentName: string;
}): Promise<(ManifestVersionRecord & { outputPath: string }) | null> {
  const { cwd, agentName } = params;
  const agentMetaDir = join(cwd, "meta", "migrations", agentName);
  const snapshotPath = join(cwd, "meta", "snapshot.json");

  const snapshot = await readSnapshot(snapshotPath);
  const agentEntry = snapshot[agentName];

  if (agentEntry?.latest) {
    const latestFile = join(agentMetaDir, `${agentEntry.latest}.json`);
    const latest = await readManifestVersionFile(latestFile);
    if (latest) {
      return {
        ...latest,
        outputPath: latestFile,
      };
    }
  }

  const files = await readdir(agentMetaDir).catch(() => [] as string[]);
  const records = (
    await Promise.all(
      files
        .filter(isManifestVersionFile)
        .map((file) => readManifestVersionFile(join(agentMetaDir, file))),
    )
  ).filter((record): record is ManifestVersionRecord => record !== null);

  if (records.length === 0) {
    return null;
  }

  const newest = records.sort((a, b) => b.version - a.version)[0] ?? null;
  if (!newest) {
    return null;
  }

  return {
    ...newest,
    outputPath: join(agentMetaDir, `${newest.versionId}.json`),
  };
}
