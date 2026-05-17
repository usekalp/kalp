import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execa } from "execa";
import { requireAuth } from "@/utils/auth";
import { ensureStudioSecrets } from "@/utils/secret";
import { readProjectState, writeProjectState } from "@/utils/project-state";
import { materializeRuntime } from "@/utils/runtime";
import {
  getRequiredSecretForProvider,
  readDotEnv,
  resolveProviderFromConfig,
} from "@/utils/ai";
import {
  loadProjectConfig,
  resolveIdentityAuthRequirements,
  resolveRuntimeIdentityConfig,
} from "@/utils/project-config";
import { resolveProvider } from "@/utils/providers";

interface RuntimeWranglerConfig {
  name?: string;
  kv_namespaces?: Array<{ binding: string; id?: string }>;
}

interface KvNamespaceInfo {
  id: string;
  title: string;
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

async function listKvNamespaces(
  cwd: string,
  configPath: string,
): Promise<KvNamespaceInfo[]> {
  const provider = resolveProvider();
  const namespaces = await provider.listNamespaces({ cwd, configPath });
  return namespaces.map((item) => ({
    id: item.id,
    title: item.title,
  }));
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

  // List namespaces using wrangler directly
  const listResult = await execa(
    "npx",
    ["wrangler", "kv", "namespace", "list", "--config", configPath],
    { cwd },
  ).catch(() => null);

  if (listResult) {
    try {
      const namespaces = JSON.parse(listResult.stdout) as Array<{ id: string; title: string }>;
      const existing = namespaces.find((item) => item.title === expectedTitle);
      if (existing) {
        binding.id = existing.id;
        await writeWranglerConfig(configPath, config);
        return existing.id;
      }
    } catch {
      // JSON parse failed, fall through to create
    }
  }

  // Create the namespace if it doesn't exist
  const createResult = await execa(
    "npx",
    ["wrangler", "kv", "namespace", "create", expectedTitle, "--config", configPath],
    { cwd },
  );
  const idMatch = createResult.stdout.match(/"id":\s*"([^"]+)"/);
  if (!idMatch) return null;

  binding.id = idMatch[1];
  await writeWranglerConfig(configPath, config);
  return idMatch[1];
}

function isNamespaceAlreadyExistsError(output: string): boolean {
  return output.includes("[code: 10014]") && output.includes("already exists");
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
  const loadedConfig = await loadProjectConfig(cwd);
  const identityConfig = resolveRuntimeIdentityConfig(loadedConfig.raw);
  const identitySecretRequirements = resolveIdentityAuthRequirements(identityConfig);
  const aiProvider = await resolveProviderFromConfig(cwd);
  const requiredProviderSecret = getRequiredSecretForProvider(aiProvider);
  const secrets = await ensureStudioSecrets(cwd);
  const envMap = await readDotEnv(cwd);
  const providerSecretValue = envMap[requiredProviderSecret]?.trim();
  if (!providerSecretValue) {
    throw new Error(
      `Missing required secret ${requiredProviderSecret} for provider "${aiProvider}". Add it to .env before deploy.`,
    );
  }

  const resolvedIdentitySecrets = identitySecretRequirements.map((requirement) => {
    const value = envMap[requirement.envKey]?.trim();
    if (!value) {
      throw new Error(
        `Missing required secret ${requirement.envKey} for ${requirement.reason}. Add it to .env before deploy.`,
      );
    }
    return { name: requirement.envKey, value };
  });

  const runtimeProvider = resolveProvider();
  const runtime = await materializeRuntime(cwd);
  let secretSyncFailed = false;
  const secretEntries = [
    ["KALP_SECRET_KEY", secrets.key],
    ["KALP_STUDIO_PASSWORD", secrets.studioPassword],
    ["KALP_STUDIO_ADMIN_USER", secrets.studioAdminUser],
    ["KALP_SERVICE_KEY", secrets.serviceKey],
    [requiredProviderSecret, providerSecretValue],
    ...resolvedIdentitySecrets.map((item) => [item.name, item.value] as const),
  ];
  const dedupedSecrets = new Map<string, string>();
  for (const [name, value] of secretEntries) {
    dedupedSecrets.set(name, value);
  }

  for (const [name, value] of dedupedSecrets.entries()) {
    try {
      await runtimeProvider.putSecret({
        cwd,
        configPath: runtime.wranglerConfigPath,
        name,
        value,
      });
    } catch {
      secretSyncFailed = true;
      break;
    }
  }

  await ensureKvNamespaceBindingId(cwd, runtime.wranglerConfigPath).catch(
    () => null,
  );

  let deploy = await runtimeProvider
    .deployRuntime({
      cwd,
      configPath: runtime.wranglerConfigPath,
      useSecretsFile: secretSyncFailed,
    })
    .catch((error) => error);
  if (deploy instanceof Error) {
    const combined = deploy.message;
    if (isNamespaceAlreadyExistsError(combined)) {
      await ensureKvNamespaceBindingId(cwd, runtime.wranglerConfigPath);
      deploy = await runtimeProvider.deployRuntime({
        cwd,
        configPath: runtime.wranglerConfigPath,
        useSecretsFile: secretSyncFailed,
      });
    } else {
      throw deploy;
    }
  }

  const workerUrl = deploy.workerUrl;
  const customDomains = deploy.customDomains ?? [];

  const existingState = await readProjectState(cwd);

  const credentialsFingerprint = createHash("sha256")
    .update(`${secrets.studioAdminUser}:${secrets.studioPassword}`)
    .digest("hex");
  const credentialsChanged =
    existingState?.studioCredentialsFingerprint !== credentialsFingerprint;
  const serviceKeyFingerprint = createHash("sha256")
    .update(secrets.serviceKey)
    .digest("hex");
  const serviceKeyChanged =
    existingState?.serviceKeyFingerprint !== serviceKeyFingerprint;

  await writeProjectState(cwd, {
    workerUrl,
    deployedAt: new Date().toISOString(),
    accountId: auth.accountId,
    studioCredentialsFingerprint: credentialsFingerprint,
    serviceKeyFingerprint,
    agents: existingState?.agents ?? {},
  });

  return {
    workerUrl,
    customDomains,
    accountId: auth.accountId,
    studioAdminUser: secrets.studioAdminUser,
    studioPassword: secrets.studioPassword,
    serviceKey: secrets.serviceKey,
    credentialsChanged,
    serviceKeyChanged,
  };
}
