import { readFile } from "node:fs/promises";
import { execa } from "execa";
import { requireAuth } from "@/utils/auth";
import { ensureStudioSecrets } from "@/utils/secret";
import { writeProjectState } from "@/utils/project-state";
import { materializeRuntime } from "@/utils/runtime";

function findWorkersUrl(output: string): string | null {
  const match = output.match(/https:\/\/[^\s]+\.workers\.dev/);
  return match?.[0] ?? null;
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
  const secrets = await ensureStudioSecrets(cwd);
  const runtime = await materializeRuntime(cwd);
  let secretSyncFailed = false;
  const secretEntries = [
    ["KALP_SECRET_KEY", secrets.key],
    ["KALP_STUDIO_PASSWORD", secrets.studioPassword],
    ["KALP_STUDIO_ADMIN_USER", secrets.studioAdminUser],
  ] as const;

  for (const [name, value] of secretEntries) {
    try {
      await execa(
        "npx",
        ["wrangler", "secret", "put", name, "--config", runtime.wranglerConfigPath],
        { cwd, input: `${value}\n` },
      );
    } catch {
      secretSyncFailed = true;
      break;
    }
  }

  const deploy = await execa(
    "npx",
    secretSyncFailed
      ? [
          "wrangler",
          "deploy",
          "--config",
          runtime.wranglerConfigPath,
          "--secrets-file",
          ".env",
        ]
      : ["wrangler", "deploy", "--config", runtime.wranglerConfigPath],
    {
      cwd,
    },
  );

  const deployStdout = [deploy.stdout, deploy.stderr]
    .filter(Boolean)
    .join("\n");

  const workerUrl = await resolveWorkerUrl(
    runtime.wranglerConfigPath,
    deployStdout,
  );

  await writeProjectState(cwd, {
    workerUrl,
    deployedAt: new Date().toISOString(),
    accountId: auth.accountId,
  });

  return { workerUrl, accountId: auth.accountId };
}
