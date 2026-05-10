import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SECRET_KEY = "KALP_SECRET_KEY";
const STUDIO_PASSWORD = "KALP_STUDIO_PASSWORD";
const STUDIO_ADMIN_USER = "KALP_STUDIO_ADMIN_USER";

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[key] = value;
  }
  return result;
}

function toEnvContent(values: Record<string, string>): string {
  const lines = [
    "# Kalp Studio Authentication Secrets",
    `${SECRET_KEY}=${values[SECRET_KEY]}`,
    `${STUDIO_PASSWORD}=${values[STUDIO_PASSWORD]}`,
    `${STUDIO_ADMIN_USER}=${values[STUDIO_ADMIN_USER]}`,
    "",
  ];
  return lines.join("\n");
}

async function readEnvFile(cwd: string): Promise<string> {
  const envPath = join(cwd, ".env");
  try {
    return await readFile(envPath, "utf-8");
  } catch {
    return "";
  }
}

function generateStudioPassword(): string {
  return randomBytes(24).toString("base64url");
}

export interface StudioSecrets {
  key: string;
  studioPassword: string;
  studioAdminUser: string;
  isNew: boolean;
}

export async function ensureStudioSecrets(cwd: string): Promise<StudioSecrets> {
  const envPath = join(cwd, ".env");
  const content = await readEnvFile(cwd);
  const parsed = parseEnv(content);

  const key = parsed[SECRET_KEY] || randomBytes(32).toString("hex");
  const studioPassword = parsed[STUDIO_PASSWORD] || generateStudioPassword();
  const studioAdminUser = parsed[STUDIO_ADMIN_USER] || "admin";

  const isNew =
    !parsed[SECRET_KEY] || !parsed[STUDIO_PASSWORD] || !parsed[STUDIO_ADMIN_USER];

  if (isNew || !content.trim()) {
    await writeFile(
      envPath,
      toEnvContent({
        ...parsed,
        [SECRET_KEY]: key,
        [STUDIO_PASSWORD]: studioPassword,
        [STUDIO_ADMIN_USER]: studioAdminUser,
      }),
      "utf-8",
    );
  }

  return { key, studioPassword, studioAdminUser, isNew };
}

export async function ensureSecretKey(
  cwd: string,
): Promise<{ key: string; isNew: boolean }> {
  const secrets = await ensureStudioSecrets(cwd);
  return { key: secrets.key, isNew: secrets.isNew };
}

export async function readSecretKey(cwd: string): Promise<string | null> {
  try {
    const envContent = await readEnvFile(cwd);
    const parsed = parseEnv(envContent);
    return parsed[SECRET_KEY] ?? null;
  } catch {
    return null;
  }
}

export async function readStudioSecrets(cwd: string): Promise<{
  key: string;
  studioPassword: string;
  studioAdminUser: string;
} | null> {
  try {
    const envContent = await readEnvFile(cwd);
    const parsed = parseEnv(envContent);
    const key = parsed[SECRET_KEY];
    const studioPassword = parsed[STUDIO_PASSWORD];
    const studioAdminUser = parsed[STUDIO_ADMIN_USER] || "admin";
    if (!key || !studioPassword) return null;
    return { key, studioPassword, studioAdminUser };
  } catch {
    return null;
  }
}
