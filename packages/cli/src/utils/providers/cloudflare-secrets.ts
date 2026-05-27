import { execa } from "execa";
import type { RemoteSecret } from "@/utils/providers/types";

export function parseSecretsList(stdout: string): RemoteSecret[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    const secrets: RemoteSecret[] = [];
    for (const item of parsed) {
      const record = item as Record<string, unknown>;
      const name = record.name;
      if (typeof name !== "string" || name.length === 0) continue;
      const type = typeof record.type === "string" ? record.type : undefined;
      if (type) {
        secrets.push({ name, type });
      } else {
        secrets.push({ name });
      }
    }
    return secrets;
  } catch {
    return [];
  }
}

export async function secretPut(
  cwd: string,
  configPath: string,
  name: string,
  value: string,
): Promise<void> {
  await execa(
    "npx",
    ["wrangler", "secret", "put", name, "--config", configPath],
    { cwd, input: `${value}\n` },
  );
}

export async function secretList(
  cwd: string,
  configPath: string,
): Promise<RemoteSecret[]> {
  const jsonAttempt = await execa(
    "npx",
    [
      "wrangler",
      "secret",
      "list",
      "--config",
      configPath,
      "--format",
      "json",
    ],
    { cwd },
  ).catch(() => null);
  if (jsonAttempt) return parseSecretsList(jsonAttempt.stdout);

  const fallback = await execa(
    "npx",
    ["wrangler", "secret", "list", "--config", configPath],
    { cwd },
  );
  return parseSecretsList(fallback.stdout);
}

export async function secretDelete(
  cwd: string,
  configPath: string,
  name: string,
): Promise<void> {
  await execa(
    "npx",
    ["wrangler", "secret", "delete", name, "--config", configPath],
    { cwd },
  );
}
