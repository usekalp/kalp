import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function ensureSecretKey(
  cwd: string,
): Promise<{ key: string; isNew: boolean }> {
  const envPath = join(cwd, ".env");

  try {
    const envContent = await readFile(envPath, "utf-8");
    const match = envContent.match(/^KALP_SECRET_KEY=(.+)$/m);
    if (match?.[1]) {
      return { key: match[1].trim(), isNew: false };
    }
  } catch {
    // continue
  }

  const secretKey = randomBytes(32).toString("hex");
  const content = `# Kalp Studio Authentication Secret
KALP_SECRET_KEY=${secretKey}
`;
  await writeFile(envPath, content, "utf-8");
  return { key: secretKey, isNew: true };
}

export async function readSecretKey(cwd: string): Promise<string | null> {
  try {
    const envPath = join(cwd, ".env");
    const envContent = await readFile(envPath, "utf-8");
    const match = envContent.match(/^KALP_SECRET_KEY=(.+)$/m);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}
