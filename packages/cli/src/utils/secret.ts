import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const SECRET_KEY = "KALP_SECRET_KEY";
export const STUDIO_PASSWORD = "KALP_STUDIO_PASSWORD";
export const STUDIO_ADMIN_USER = "KALP_STUDIO_ADMIN_USER";
export const SERVICE_KEY = "KALP_SERVICE_KEY";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function applyEnvUpdates(content: string, updates: Record<string, string>): string {
  let next = content;
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");
    if (pattern.test(next)) {
      next = next.replace(pattern, line);
      continue;
    }
    const trimmed = next.trimEnd();
    next = trimmed.length > 0 ? `${trimmed}\n${line}\n` : `${line}\n`;
  }

  return next.trimEnd() + "\n";
}

async function readEnvFile(cwd: string): Promise<string> {
  const envPath = join(cwd, ".env");
  try {
    return await readFile(envPath, "utf-8");
  } catch {
    return "";
  }
}

async function readDevVarsFile(cwd: string): Promise<string> {
  const devVarsPath = join(cwd, ".dev.vars");
  try {
    return await readFile(devVarsPath, "utf-8");
  } catch {
    return "";
  }
}

function generateStudioPassword(): string {
  return randomBytes(24).toString("base64url");
}

function generateServiceKey(): string {
  return `kalp_sk_live_${randomBytes(32).toString("base64url")}`;
}

export interface StudioSecrets {
  key: string;
  studioPassword: string;
  studioAdminUser: string;
  serviceKey: string;
  isNew: boolean;
}

export async function ensureStudioSecrets(cwd: string): Promise<StudioSecrets> {
  const envPath = join(cwd, ".env");
  const devVarsPath = join(cwd, ".dev.vars");
  const content = await readEnvFile(cwd);
  const parsed = parseEnv(content);

  const key = parsed[SECRET_KEY]?.trim() || randomBytes(32).toString("hex");
  const studioPassword = parsed[STUDIO_PASSWORD]?.trim() || generateStudioPassword();
  const studioAdminUser = parsed[STUDIO_ADMIN_USER]?.trim() || "admin";
  const serviceKey = parsed[SERVICE_KEY]?.trim() || generateServiceKey();

  const isNew =
    !parsed[SECRET_KEY]?.trim() ||
    !parsed[STUDIO_PASSWORD]?.trim() ||
    !parsed[STUDIO_ADMIN_USER]?.trim() ||
    !parsed[SERVICE_KEY]?.trim();

  const next = applyEnvUpdates(content, {
    [SECRET_KEY]: key,
    [STUDIO_PASSWORD]: studioPassword,
    [STUDIO_ADMIN_USER]: studioAdminUser,
    [SERVICE_KEY]: serviceKey,
  });
  await writeFile(envPath, next, "utf-8");

  const devVarsContent = await readDevVarsFile(cwd);
  const nextDevVars = applyEnvUpdates(devVarsContent, {
    [SECRET_KEY]: key,
    [STUDIO_PASSWORD]: studioPassword,
    [STUDIO_ADMIN_USER]: studioAdminUser,
    [SERVICE_KEY]: serviceKey,
  });
  await writeFile(devVarsPath, nextDevVars, "utf-8");

  return { key, studioPassword, studioAdminUser, serviceKey, isNew };
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
  serviceKey: string;
} | null> {
  try {
    const envContent = await readEnvFile(cwd);
    const parsed = parseEnv(envContent);
    const key = parsed[SECRET_KEY]?.trim();
    const studioPassword = parsed[STUDIO_PASSWORD]?.trim();
    const studioAdminUser = parsed[STUDIO_ADMIN_USER]?.trim() || "admin";
    const serviceKey = parsed[SERVICE_KEY]?.trim();
    if (!key || !studioPassword || !serviceKey) return null;
    return { key, studioPassword, studioAdminUser, serviceKey };
  } catch {
    return null;
  }
}
