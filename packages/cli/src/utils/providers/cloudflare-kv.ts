import { execa } from "execa";
import { rm, writeFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export function parseNamespaceList(stdout: string): Array<{ id: string; title: string }> {
  try {
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          id: String((item as { id?: string }).id ?? ""),
          title: String((item as { title?: string }).title ?? ""),
        }))
        .filter((item) => !!item.id && !!item.title);
    }
  } catch {}
  return [];
}

export function parseKvKeyList(stdout: string): Array<{ name: string }> {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const record = item as Record<string, unknown>;
        const name = record.name;
        return typeof name === "string" && name.length > 0 ? { name } : null;
      })
      .filter((item): item is { name: string } => !!item);
  } catch {
    return [];
  }
}

async function withTempTextFile<T>(
  prefix: string,
  payload: string,
  fn: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const filePath = join(dir, "payload.txt");
  await writeFile(filePath, payload, "utf-8");
  try {
    return await fn(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withTempJsonFile<T>(
  prefix: string,
  payload: unknown,
  fn: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const filePath = join(dir, "payload.json");
  await writeFile(filePath, JSON.stringify(payload), "utf-8");
  try {
    return await fn(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function kvPutManifest(
  cwd: string,
  configPath: string,
  key: string,
  jsonPath: string,
): Promise<void> {
  await execa(
    "npx",
    [
      "wrangler",
      "kv",
      "key",
      "put",
      "--binding",
      "KALP_MANIFESTS",
      key,
      "--path",
      jsonPath,
      "--remote",
      "--config",
      configPath,
    ],
    { cwd },
  );
}

export async function kvPutValue(
  cwd: string,
  configPath: string,
  key: string,
  value: string,
): Promise<void> {
  await withTempTextFile("kalp-kv-put-", value, async (valuePath) => {
    await execa(
      "npx",
      [
        "wrangler",
        "kv",
        "key",
        "put",
        "--binding",
        "KALP_MANIFESTS",
        key,
        "--path",
        valuePath,
        "--remote",
        "--config",
        configPath,
      ],
      { cwd },
    );
  });
}

export async function kvPutBulkValues(
  cwd: string,
  configPath: string,
  values: Array<{ key: string; value: string }>,
): Promise<void> {
  if (values.length === 0) return;
  await withTempJsonFile("kalp-kv-bulk-put-", values, async (jsonPath) => {
    await execa(
      "npx",
      [
        "wrangler",
        "kv",
        "bulk",
        "put",
        jsonPath,
        "--binding",
        "KALP_MANIFESTS",
        "--remote",
        "--config",
        configPath,
      ],
      { cwd },
    );
  });
}

export async function kvDeleteValue(
  cwd: string,
  configPath: string,
  key: string,
): Promise<void> {
  await execa(
    "npx",
    [
      "wrangler",
      "kv",
      "key",
      "delete",
      "--binding",
      "KALP_MANIFESTS",
      key,
      "--remote",
      "--config",
      configPath,
    ],
    { cwd },
  );
}

export async function kvGetValue(
  cwd: string,
  configPath: string,
  key: string,
): Promise<string | null> {
  const result = await execa(
    "npx",
    [
      "wrangler",
      "kv",
      "key",
      "get",
      "--binding",
      "KALP_MANIFESTS",
      key,
      "--remote",
      "--config",
      configPath,
    ],
    { cwd },
  ).catch(() => null);
  const output = result?.stdout?.trim();
  return output ? output : null;
}

export async function kvListNamespaces(
  cwd: string,
  configPath: string,
): Promise<Array<{ id: string; title: string }>> {
  const json = await execa(
    "npx",
    ["wrangler", "kv", "namespace", "list", "--config", configPath, "--json"],
    { cwd },
  ).catch(() => null);
  if (json) return parseNamespaceList(json.stdout);
  const plain = await execa(
    "npx",
    ["wrangler", "kv", "namespace", "list", "--config", configPath],
    { cwd },
  );
  return parseNamespaceList(plain.stdout);
}

export async function kvListKeys(
  cwd: string,
  configPath: string,
  prefix: string,
): Promise<Array<{ name: string }>> {
  const args = [
    "wrangler",
    "kv",
    "key",
    "list",
    "--binding",
    "KALP_MANIFESTS",
    "--remote",
    "--config",
    configPath,
  ];
  if (prefix && prefix.trim()) {
    args.push("--prefix", prefix.trim());
  }
  const jsonAttempt = await execa("npx", [...args, "--format", "json"], {
    cwd,
  }).catch(() => null);
  if (jsonAttempt) return parseKvKeyList(jsonAttempt.stdout);

  const fallback = await execa("npx", args, { cwd });
  return parseKvKeyList(fallback.stdout);
}
