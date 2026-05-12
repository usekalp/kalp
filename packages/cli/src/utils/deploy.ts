import { readFile, writeFile } from "node:fs/promises";
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
import { resolveProvider } from "@/utils/providers";

function findWorkersUrl(output: string): string | null {
  const match = output.match(/https:\/\/[^\s]+\.workers\.dev/);
  return match?.[0] ?? null;
}

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

function parseKvListOutput(stdout: string): KvNamespaceInfo[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          id: String((item as { id?: string }).id ?? ""),
          title: String((item as { title?: string }).title ?? ""),
        }))
        .filter((item) => !!item.id && !!item.title);
    }
  } catch {
    // fallback to text parsing below
  }

  const matches = trimmed.match(/[a-f0-9]{32}\s+[^\r\n]+/gi) ?? [];
  return matches
    .map((line) => {
      const [id, ...rest] = line.trim().split(/\s+/g);
      return { id: id ?? "", title: rest.join(" ") };
    })
    .filter((item) => !!item.id && !!item.title);
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

async function ensureKvNamespaceBindingId(
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
  const namespaces = await listKvNamespaces(cwd, configPath);
  const existing = namespaces.find((item) => item.title === expectedTitle);
  if (!existing) return null;

  binding.id = existing.id;
  await writeWranglerConfig(configPath, config);
  return existing.id;
}

function isNamespaceAlreadyExistsError(output: string): boolean {
  return output.includes("[code: 10014]") && output.includes("already exists");
}

async function resolveWorkerUrl(
  configPath: string,
  deployOutput: string,
): Promise<string> {
  const fromOutput = findWorkersUrl(deployOutput);
  if (fromOutput) return fromOutput;

  const configText = await readFile(configPath, "utf-8").catch(
    () => null as string | null,
  );
  const workerName = configText?.match(/"name"\s*:\s*"([^"]+)"/)?.[1];

  if (workerName) {
    return `https://${workerName}.workers.dev`;
  }

  throw new Error("Could not resolve worker URL from wrangler deploy output.");
}

export async function runInitialDeploy(cwd: string): Promise<{
  workerUrl: string;
  accountId: string;
}> {
  const auth = await requireAuth();
  const aiProvider = await resolveProviderFromConfig(cwd);
  const requiredProviderSecret = getRequiredSecretForProvider(aiProvider);
  const envMap = await readDotEnv(cwd);
  const providerSecretValue = envMap[requiredProviderSecret]?.trim();
  if (!providerSecretValue) {
    throw new Error(
      `Missing required secret ${requiredProviderSecret} for provider "${aiProvider}". Add it to .env before deploy.`,
    );
  }

  const secrets = await ensureStudioSecrets(cwd);
  const runtimeProvider = resolveProvider();
  const runtime = await materializeRuntime(cwd);
  let secretSyncFailed = false;
  const secretEntries = [
    ["KALP_SECRET_KEY", secrets.key],
    ["KALP_STUDIO_PASSWORD", secrets.studioPassword],
    ["KALP_STUDIO_ADMIN_USER", secrets.studioAdminUser],
    [requiredProviderSecret, providerSecretValue],
  ] as const;

  for (const [name, value] of secretEntries) {
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

  const deployArgs = secretSyncFailed
    ? [
        "wrangler",
        "deploy",
        "--config",
        runtime.wranglerConfigPath,
        "--secrets-file",
        ".env",
      ]
    : ["wrangler", "deploy", "--config", runtime.wranglerConfigPath];

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

  const existingState = await readProjectState(cwd);

  await writeProjectState(cwd, {
    workerUrl,
    deployedAt: new Date().toISOString(),
    accountId: auth.accountId,
    agents: existingState?.agents ?? {},
  });

  return { workerUrl, accountId: auth.accountId };
}
