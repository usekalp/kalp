import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execa } from "execa";
import { requireAuth } from "@/utils/auth";
import { ensureStudioSecrets } from "@/utils/secret";
import { readProjectState, writeProjectState } from "@/utils/project-state";
import { materializeRuntime } from "@/utils/runtime";
import { getRequiredAiSecrets, readDotEnv } from "@/utils/ai";
import {
  loadProjectConfig,
  resolveIdentityAuthRequirements,
  resolveRuntimeIdentityConfig,
  type RuntimeIdentityConfig,
} from "@/utils/project-config";
import { resolveProvider } from "@/utils/providers";
import type {
  RuntimeProvider,
  DeployResult,
} from "@/utils/providers/types";
import { injectRuntimeConfigs } from "@/utils/runtime-config-inject";

interface RuntimeWranglerConfig {
  name?: string;
  kv_namespaces?: Array<{ binding: string; id?: string }>;
}

async function readWranglerConfig(
  configPath: string,
): Promise<RuntimeWranglerConfig> {
  const text = await readFile(configPath, "utf-8");
  return JSON.parse(text) as RuntimeWranglerConfig;
}

async function writeWranglerConfig(
  configPath: string,
  config: RuntimeWranglerConfig,
): Promise<void> {
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function deriveKvNamespaceTitle(workerName: string, binding: string): string {
  return `${workerName}-${binding.toLowerCase().replace(/_/g, "-")}`;
}

export async function ensureKvNamespaceBindingId(
  cwd: string,
  configPath: string,
): Promise<string | null> {
  const config = await readWranglerConfig(configPath);
  const binding = config.kv_namespaces?.find(
    (item) => item.binding === "KALP_MANIFESTS",
  );
  if (!binding || !config.name) return null;
  if (binding.id) return binding.id;

  const expectedTitle = deriveKvNamespaceTitle(config.name, binding.binding);
  const listResult = await execa(
    "npx",
    ["wrangler", "kv", "namespace", "list", "--config", configPath],
    { cwd },
  ).catch(() => null);

  if (listResult) {
    try {
      const namespaces = JSON.parse(listResult.stdout) as Array<{
        id: string;
        title: string;
      }>;
      const existing = namespaces.find((item) => item.title === expectedTitle);
      if (existing) {
        binding.id = existing.id;
        await writeWranglerConfig(configPath, config);
        return existing.id;
      }
    } catch {}
  }

  const createResult = await execa(
    "npx",
    [
      "wrangler",
      "kv",
      "namespace",
      "create",
      expectedTitle,
      "--config",
      configPath,
    ],
    { cwd },
  );
  const idMatch = createResult.stdout.match(/"id":\s*"([^"]+)"/);
  if (!idMatch || !idMatch[1]) return null;

  binding.id = idMatch[1];
  await writeWranglerConfig(configPath, config);
  return idMatch[1];
}

export function isNamespaceAlreadyExistsError(output: string): boolean {
  return output.includes("[code: 10014]") && output.includes("already exists");
}

type SecretEntry = [string, string];

function collectSecretEntries(params: {
  studioSecrets: Awaited<ReturnType<typeof ensureStudioSecrets>>;
  envMap: Record<string, string>;
  identityConfig: RuntimeIdentityConfig;
}): SecretEntry[] {
  const { studioSecrets, envMap, identityConfig } = params;

  const aiSecrets = getRequiredAiSecrets();
  const aiEntries: SecretEntry[] = [];
  for (const secret of aiSecrets) {
    const value = envMap[secret]?.trim();
    if (value) aiEntries.push([secret, value]);
  }

  const identityRequirements = resolveIdentityAuthRequirements(identityConfig);
  const identityEntries = identityRequirements.map((req) => {
    const value = envMap[req.envKey]?.trim();
    if (!value) {
      throw new Error(
        `Missing required secret ${req.envKey} for ${req.reason}. Add it to .env before deploy.`,
      );
    }
    return [req.envKey, value] as [string, string];
  });

  const entries: SecretEntry[] = [
    ["KALP_SECRET_KEY", studioSecrets.key],
    ["KALP_STUDIO_PASSWORD", studioSecrets.studioPassword],
    ["KALP_STUDIO_ADMIN_USER", studioSecrets.studioAdminUser],
    ["KALP_SERVICE_KEY", studioSecrets.serviceKey],
    ...aiEntries,
    ...identityEntries,
  ];

  const deduped = new Map<string, string>();
  for (const [name, value] of entries) deduped.set(name, value);
  return [...deduped.entries()];
}

async function syncSecrets(
  provider: RuntimeProvider,
  cwd: string,
  configPath: string,
  secrets: SecretEntry[],
): Promise<boolean> {
  for (const [name, value] of secrets) {
    try {
      await provider.putSecret({ cwd, configPath, name, value });
    } catch {
      return true;
    }
  }
  return false;
}

async function deployWithRetry(
  provider: RuntimeProvider,
  cwd: string,
  configPath: string,
  useSecretsFile: boolean,
): Promise<DeployResult> {
  let result = await provider
    .deployRuntime({ cwd, configPath, useSecretsFile })
    .catch((error) => error);
  if (result instanceof Error) {
    if (isNamespaceAlreadyExistsError(result.message)) {
      await ensureKvNamespaceBindingId(cwd, configPath);
      result = await provider.deployRuntime({
        cwd,
        configPath,
        useSecretsFile,
      });
    } else {
      throw result;
    }
  }
  return result;
}

interface CredentialsState {
  credentialsFingerprint: string;
  serviceKeyFingerprint: string;
}

function resolveFingerprints(
  adminUser: string,
  adminPassword: string,
  serviceKey: string,
): CredentialsState {
  return {
    credentialsFingerprint: createHash("sha256")
      .update(`${adminUser}:${adminPassword}`)
      .digest("hex"),
    serviceKeyFingerprint: createHash("sha256")
      .update(serviceKey)
      .digest("hex"),
  };
}

export async function runInitialDeploy(cwd: string): Promise<{
  workerUrl: string;
  customDomains: string[];
  accountId: string;
  studioAdminUser: string;
  studioPassword: string;
  serviceKey: string;
  credentialsChanged: boolean;
  serviceKeyChanged: boolean;
}> {
  const auth = await requireAuth();
  const { raw } = await loadProjectConfig(cwd);
  const identityConfig = resolveRuntimeIdentityConfig(raw);
  const studioSecrets = await ensureStudioSecrets(cwd);
  const envMap = await readDotEnv(cwd);

  const secretEntries = collectSecretEntries({
    studioSecrets,
    envMap,
    identityConfig,
  });

  const provider = resolveProvider();
  const runtime = await materializeRuntime(cwd);
  const secretSyncFailed = await syncSecrets(
    provider,
    cwd,
    runtime.wranglerConfigPath,
    secretEntries,
  );

  await ensureKvNamespaceBindingId(cwd, runtime.wranglerConfigPath).catch(() => null);

  await injectRuntimeConfigs({
    wranglerConfigPath: runtime.wranglerConfigPath,
    aiRaw: raw.ai,
    identityConfig,
    mcpRaw: raw.mcp,
    envMap,
    cloudflareAccountId: auth.accountId,
  });

  const deploy = await deployWithRetry(
    provider,
    cwd,
    runtime.wranglerConfigPath,
    secretSyncFailed,
  );

  const fingerprints = resolveFingerprints(
    studioSecrets.studioAdminUser,
    studioSecrets.studioPassword,
    studioSecrets.serviceKey,
  );

  const existingState = await readProjectState(cwd);
  const credentialsChanged =
    existingState?.studioCredentialsFingerprint !== fingerprints.credentialsFingerprint;
  const serviceKeyChanged =
    existingState?.serviceKeyFingerprint !== fingerprints.serviceKeyFingerprint;

  await writeProjectState(cwd, {
    workerUrl: deploy.workerUrl,
    deployedAt: new Date().toISOString(),
    accountId: auth.accountId,
    studioCredentialsFingerprint: fingerprints.credentialsFingerprint,
    serviceKeyFingerprint: fingerprints.serviceKeyFingerprint,
    agents: existingState?.agents ?? {},
  });

  return {
    workerUrl: deploy.workerUrl,
    customDomains: deploy.customDomains ?? [],
    accountId: auth.accountId,
    studioAdminUser: studioSecrets.studioAdminUser,
    studioPassword: studioSecrets.studioPassword,
    serviceKey: studioSecrets.serviceKey,
    credentialsChanged,
    serviceKeyChanged,
  };
}
