import { readFile } from "node:fs/promises";
import { join } from "node:path";

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of content.split(/\r?\n/g)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1);
  }
  return env;
}

export async function readDotEnv(cwd: string): Promise<Record<string, string>> {
  const envPath = join(cwd, ".env");
  const content = await readFile(envPath, "utf-8").catch(() => "");
  return parseEnv(content);
}

export function getRequiredAiSecrets(): string[] {
  return [];
}
