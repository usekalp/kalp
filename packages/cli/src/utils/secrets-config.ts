import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SECRETS_ARRAY_REGEX = /secrets:\s*\[([\s\S]*?)\]/m;
const SECRET_LITERAL_REGEX = /["'`]([^"'`]+)["'`]/g;

export async function readLocalSecretsFromConfig(cwd: string): Promise<string[]> {
  const configPath = join(cwd, "kalp.config.ts");
  const content = await readFile(configPath, "utf-8").catch(() => {
    throw new Error("kalp.config.ts not found. Run create-kalp first.");
  });

  const match = content.match(SECRETS_ARRAY_REGEX);
  if (!match) return [];
  const body = match[1] ?? "";
  const values: string[] = [];
  let item: RegExpExecArray | null;
  while ((item = SECRET_LITERAL_REGEX.exec(body)) !== null) {
    if (item[1]) values.push(item[1]);
  }
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export async function writeLocalSecretsToConfig(
  cwd: string,
  secrets: string[],
): Promise<void> {
  const configPath = join(cwd, "kalp.config.ts");
  const content = await readFile(configPath, "utf-8").catch(() => {
    throw new Error("kalp.config.ts not found. Run create-kalp first.");
  });

  if (!SECRETS_ARRAY_REGEX.test(content)) {
    throw new Error(
      "Could not find `secrets: []` in kalp.config.ts. Add a secrets array first.",
    );
  }

  const sorted = [...new Set(secrets)]
    .map((value) => value.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const serialized =
    sorted.length > 0 ? sorted.map((secret) => `"${secret}"`).join(", ") : "";
  const next = content.replace(SECRETS_ARRAY_REGEX, `secrets: [${serialized}]`);
  await writeFile(configPath, next, "utf-8");
}

export function mergeSecrets(
  base: string[],
  incoming: string[],
): string[] {
  return [...new Set([...base, ...incoming].map((value) => value.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}
