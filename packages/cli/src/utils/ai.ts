import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { createJiti } from "jiti";

export type AIProvider = "openai" | "anthropic" | "openrouter" | "custom";

const PROVIDER_SECRET_MAP: Record<AIProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  custom: "CUSTOM_AI_API_KEY",
};

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

export async function resolveProviderFromConfig(cwd: string): Promise<AIProvider> {
  const configPath = join(cwd, "kalp.config.ts");
  await access(configPath, constants.F_OK);
  const jiti = createJiti(cwd, { interopDefault: true });
  const config = (await jiti.import(configPath)) as
    | { default?: { ai?: { provider?: AIProvider } }; ai?: { provider?: AIProvider } }
    | undefined;
  const provider = config?.default?.ai?.provider ?? config?.ai?.provider ?? "openai";
  return provider;
}

export async function readDotEnv(cwd: string): Promise<Record<string, string>> {
  const envPath = join(cwd, ".env");
  const content = await readFile(envPath, "utf-8").catch(() => "");
  return parseEnv(content);
}

export function getRequiredSecretForProvider(provider: AIProvider): string {
  return PROVIDER_SECRET_MAP[provider];
}
