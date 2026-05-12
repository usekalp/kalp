import { execa } from "execa";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RuntimeProvider } from "@/utils/providers/types";
import { getCloudflareIdentity } from "@/utils/auth";

function parseNamespaceList(stdout: string): Array<{ id: string; title: string }> {
  try {
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          id: String((item as { id?: string }).id ?? ""),
          title: String((item as { title?: string }).title ?? ""),
        }))
        .filter((item) => !!item.id && !!item.title);
    }
  } catch {}
  return [];
}

function findWorkerUrl(output: string): string | null {
  const match = output.match(/https:\/\/[^\s]+\.workers\.dev/);
  return match?.[0] ?? null;
}

export const cloudflareProvider: RuntimeProvider = {
  name: "cloudflare",
  async login() {
    await execa("npx", ["wrangler", "login"], { stdio: "inherit" });
  },
  async whoami() {
    const identity = await getCloudflareIdentity();
    const account = identity?.accounts?.[0];
    const accountId = account?.id ?? account?.account_tag;
    const email = identity?.email;
    if (!accountId || !email) return null;
    return { provider: "cloudflare", accountId, email };
  },
  async putSecret({ cwd, configPath, name, value }) {
    await execa(
      "npx",
      ["wrangler", "secret", "put", name, "--config", configPath],
      { cwd, input: `${value}\n` },
    );
  },
  async deployRuntime({ cwd, configPath, useSecretsFile }) {
    const args = useSecretsFile
      ? ["wrangler", "deploy", "--config", configPath, "--secrets-file", ".env"]
      : ["wrangler", "deploy", "--config", configPath];
    const deploy = await execa("npx", args, { cwd });
    const rawOutput = [deploy.stdout, deploy.stderr].filter(Boolean).join("\n");
    const workerUrl = findWorkerUrl(rawOutput);
    if (!workerUrl) {
      const configText = await readFile(configPath, "utf-8").catch(() => null);
      const workerName = configText?.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
      if (!workerName) {
        throw new Error("Could not resolve runtime URL from deployment output.");
      }
      return { workerUrl: `https://${workerName}.workers.dev`, rawOutput };
    }
    return { workerUrl, rawOutput };
  },
  async putManifest({ cwd, configPath, key, jsonPath }) {
    await execa(
      "npx",
      [
        "wrangler",
        "kv",
        "key",
        "put",
        "--binding",
        "KALP_MANIFESTS",
        key,
        "--path",
        jsonPath,
        "--remote",
        "--config",
        configPath,
      ],
      { cwd },
    );
  },
  async putValue({ cwd, configPath, key, value }) {
    await execa(
      "npx",
      [
        "wrangler",
        "kv",
        "key",
        "put",
        "--binding",
        "KALP_MANIFESTS",
        key,
        value,
        "--remote",
        "--config",
        configPath,
      ],
      { cwd },
    );
  },
  async getValue({ cwd, configPath, key }) {
    const result = await execa(
      "npx",
      [
        "wrangler",
        "kv",
        "key",
        "get",
        "--binding",
        "KALP_MANIFESTS",
        key,
        "--remote",
        "--config",
        configPath,
      ],
      { cwd },
    ).catch(() => null);
    const output = result?.stdout?.trim();
    return output ? output : null;
  },
  async listNamespaces({ cwd, configPath }) {
    const json = await execa(
      "npx",
      ["wrangler", "kv", "namespace", "list", "--config", configPath, "--json"],
      { cwd },
    ).catch(() => null);
    if (json) return parseNamespaceList(json.stdout);
    const plain = await execa(
      "npx",
      ["wrangler", "kv", "namespace", "list", "--config", configPath],
      { cwd },
    );
    return parseNamespaceList(plain.stdout);
  },
};

export async function withTempJsonFile<T>(
  prefix: string,
  payload: unknown,
  fn: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const filePath = join(dir, "payload.json");
  await writeFile(filePath, JSON.stringify(payload), "utf-8");
  try {
    return await fn(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
