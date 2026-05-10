import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execa } from "execa";
import { requireAuth } from "@/utils/auth";
import { ensureSecretKey } from "@/utils/secret";
import { writeProjectState } from "@/utils/project-state";

const WRANGLER_CONFIG = "packages/cloudflare/wrangler.jsonc";

function findWorkersUrl(output: string): string | null {
  const match = output.match(/https:\/\/[^\s]+\.workers\.dev/);
  return match?.[0] ?? null;
}

async function resolveWorkerUrl(cwd: string, deployOutput: string): Promise<string> {
  const fromOutput = findWorkersUrl(deployOutput);
  if (fromOutput) return fromOutput;

  const configText = await readFile(join(cwd, WRANGLER_CONFIG), "utf-8").catch(
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
  const { key: secretKey } = await ensureSecretKey(cwd);

  await execa("pnpm", ["--filter=@kalphq/studio", "build"], {
    cwd,
    stdio: "inherit",
  });

  const studioDist = join(cwd, "apps/studio/dist");
  const workerStudioDist = join(cwd, "packages/cloudflare/dist/studio");
  await rm(workerStudioDist, { recursive: true, force: true });
  await mkdir(workerStudioDist, { recursive: true });
  await cp(studioDist, workerStudioDist, { recursive: true });

  let deployStdout = "";
  const secretResult = await execa(
    "npx",
    ["wrangler", "secret", "put", "KALP_SECRET_KEY", "--config", WRANGLER_CONFIG],
    {
      cwd,
      input: `${secretKey}\n`,
    },
  );

  const deploy = await execa(
    "npx",
    ["wrangler", "deploy", "--config", WRANGLER_CONFIG],
    {
      cwd,
    },
  );

  deployStdout = [secretResult.stdout, deploy.stdout, deploy.stderr]
    .filter(Boolean)
    .join("\n");

  const workerUrl = await resolveWorkerUrl(cwd, deployStdout);

  await writeProjectState(cwd, {
    workerUrl,
    deployedAt: new Date().toISOString(),
    accountId: auth.accountId,
  });

  return { workerUrl, accountId: auth.accountId };
}
