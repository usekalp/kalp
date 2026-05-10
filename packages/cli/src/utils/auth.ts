import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { ensureGlobalConfigDir } from "@/utils/config";

const AUTH_FILE = async () => join(await ensureGlobalConfigDir(), "auth.json");

export interface AuthConfig {
  provider: "cloudflare";
  accountId: string;
  email: string;
  expiresAt: string;
}

interface CloudflareIdentity {
  loggedIn?: boolean;
  email?: string;
  accounts?: Array<{ id?: string; account_tag?: string; name?: string }>;
}

export async function getCloudflareIdentity(): Promise<CloudflareIdentity | null> {
  try {
    const run = async (args: string[]) =>
      execa("npx", args, {
        env: { FORCE_COLOR: "0", CLOUDFLARE_OUTPUT_FORMAT: "json" },
      });

    const firstAttempt = await run([
      "wrangler",
      "whoami",
      "--output-format",
      "json",
    ]).catch(() => null);

    if (firstAttempt) {
      return JSON.parse(firstAttempt.stdout) as CloudflareIdentity;
    }

    const fallback = await run(["wrangler", "whoami", "--json"]);
    return JSON.parse(fallback.stdout) as CloudflareIdentity;
  } catch {
    return null;
  }
}

export async function saveAuthConfig(config: AuthConfig): Promise<void> {
  const authPath = await AUTH_FILE();
  await writeFile(authPath, JSON.stringify(config, null, 2), "utf-8");
}

export async function getAuthConfig(): Promise<AuthConfig | null> {
  try {
    const authPath = await AUTH_FILE();
    const content = await readFile(authPath, "utf-8");
    return JSON.parse(content) as AuthConfig;
  } catch {
    return null;
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const auth = await getAuthConfig();
  if (!auth) return false;
  return new Date(auth.expiresAt).getTime() > Date.now();
}

export async function requireAuth(): Promise<AuthConfig> {
  const auth = await getAuthConfig();
  if (!auth || new Date(auth.expiresAt).getTime() <= Date.now()) {
    throw new Error("Not authenticated. Run `kalp login` first.");
  }
  return auth;
}

/**
 * Backward-compatible helper for legacy commands.
 * Returns a pseudo-token when Cloudflare auth is present.
 */
export async function getAuthToken(): Promise<string | null> {
  const auth = await getAuthConfig();
  if (!auth || new Date(auth.expiresAt).getTime() <= Date.now()) {
    return null;
  }
  return `${auth.provider}:${auth.accountId}`;
}
