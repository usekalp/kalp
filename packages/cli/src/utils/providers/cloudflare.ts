import { execa } from "execa";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RuntimeProvider, RemoteSecret } from "@/utils/providers/types";
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

function parseKvKeyList(stdout: string): Array<{ name: string }> {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const record = item as Record<string, unknown>;
        const name = record.name;
        return typeof name === "string" && name.length > 0 ? { name } : null;
      })
      .filter((item): item is { name: string } => !!item);
  } catch {
    return [];
  }
}

function parseSecretsList(stdout: string): RemoteSecret[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    const secrets: RemoteSecret[] = [];
    for (const item of parsed) {
      const record = item as Record<string, unknown>;
      const name = record.name;
      if (typeof name !== "string" || name.length === 0) continue;
      const type = typeof record.type === "string" ? record.type : undefined;
      if (type) {
        secrets.push({ name, type });
      } else {
        secrets.push({ name });
      }
    }
    return secrets;
  } catch {
    return [];
  }
}

function findWorkerUrl(output: string): string | null {
  const match = output.match(/https:\/\/[^\s]+\.workers\.dev/);
  return match?.[0] ?? null;
}

function normalizeDomainCandidate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) return null;

  const fromUrl = trimmed.match(/^https?:\/\/([^/\s]+)/i)?.[1];
  const candidate = (fromUrl ?? trimmed).replace(/^https?:\/\//i, "").split("/")[0] ?? "";
  const host = candidate.replace(/^\*\./, "").toLowerCase();

  if (!host) return null;
  if (host.includes("*")) return null;
  if (host.endsWith(".workers.dev")) return null;
  if (host.endsWith(".pages.dev")) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
  return host;
}

function extractCustomDomainsFromRoutesConfig(configText: string): string[] {
  const routesMatch = configText.match(/"routes"\s*:\s*(\[[\s\S]*?\])/);
  if (!routesMatch) return [];
  const serializedRoutes = routesMatch[1];
  if (!serializedRoutes) return [];

  try {
    const routes = JSON.parse(serializedRoutes) as Array<{
      pattern?: string;
      custom_domain?: boolean;
    }>;
    if (!Array.isArray(routes)) return [];
    const domains = routes
      .filter((route) => route?.custom_domain === true)
      .map((route) => normalizeDomainCandidate(String(route.pattern ?? "")))
      .filter((domain): domain is string => !!domain);
    return [...new Set(domains)];
  } catch {
    return [];
  }
}

function collectDomainsFromStatusNode(
  node: unknown,
  keyHint: string | null,
  out: Set<string>,
): void {
  if (typeof node === "string") {
    if (keyHint && /(domain|route|pattern)/i.test(keyHint)) {
      const normalized = normalizeDomainCandidate(node);
      if (normalized) out.add(normalized);
    }
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectDomainsFromStatusNode(item, keyHint, out);
    }
    return;
  }

  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    collectDomainsFromStatusNode(value, key, out);
  }
}

function parseCustomDomainsFromStatusOutput(statusJson: string): string[] {
  try {
    const parsed = JSON.parse(statusJson) as unknown;
    const domains = new Set<string>();
    collectDomainsFromStatusNode(parsed, null, domains);
    return [...domains].sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function resolveCustomDomains(params: {
  cwd: string;
  configPath: string;
  workerName: string;
}): Promise<string[]> {
  const { cwd, configPath, workerName } = params;

  const status = await execa(
    "npx",
    [
      "wrangler",
      "deployments",
      "status",
      "--name",
      workerName,
      "--json",
      "--config",
      configPath,
    ],
    { cwd },
  ).catch(() => null);

  const fromStatus = status ? parseCustomDomainsFromStatusOutput(status.stdout) : [];
  if (fromStatus.length > 0) return fromStatus;

  const configText = await readFile(configPath, "utf-8").catch(() => "");
  return extractCustomDomainsFromRoutesConfig(configText);
}

export const cloudflareProvider: RuntimeProvider = {
  name: "cloudflare",
  async login() {
    await execa("npx", ["wrangler", "login"]);
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
  async listSecrets({ cwd, configPath }) {
    const jsonAttempt = await execa(
      "npx",
      [
        "wrangler",
        "secret",
        "list",
        "--config",
        configPath,
        "--format",
        "json",
      ],
      { cwd },
    ).catch(() => null);
    if (jsonAttempt) return parseSecretsList(jsonAttempt.stdout);

    const fallback = await execa(
      "npx",
      ["wrangler", "secret", "list", "--config", configPath],
      { cwd },
    );
    return parseSecretsList(fallback.stdout);
  },
  async deleteSecret({ cwd, configPath, name }) {
    await execa(
      "npx",
      ["wrangler", "secret", "delete", name, "--config", configPath],
      { cwd },
    );
  },
  async deployRuntime({ cwd, configPath, useSecretsFile }) {
    const args = useSecretsFile
      ? ["wrangler", "deploy", "--config", configPath, "--secrets-file", ".env"]
      : ["wrangler", "deploy", "--config", configPath];
    const deploy = await execa("npx", args, { cwd });
    const rawOutput = [deploy.stdout, deploy.stderr].filter(Boolean).join("\n");
    const workerUrl = findWorkerUrl(rawOutput);
    const configText = await readFile(configPath, "utf-8").catch(() => null);
    const workerName = configText?.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
    const customDomains = workerName
      ? await resolveCustomDomains({ cwd, configPath, workerName }).catch(() => [])
      : [];

    if (!workerUrl) {
      if (!workerName) {
        throw new Error("Could not resolve runtime URL from deployment output.");
      }
      return {
        workerUrl: `https://${workerName}.workers.dev`,
        customDomains,
        rawOutput,
      };
    }
    return { workerUrl, customDomains, rawOutput };
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
  async deleteValue({ cwd, configPath, key }) {
    await execa(
      "npx",
      [
        "wrangler",
        "kv",
        "key",
        "delete",
        "--binding",
        "KALP_MANIFESTS",
        key,
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
  async listKeys({ cwd, configPath, prefix }) {
    const args = [
      "wrangler",
      "kv",
      "key",
      "list",
      "--binding",
      "KALP_MANIFESTS",
      "--remote",
      "--config",
      configPath,
    ];
    if (prefix && prefix.trim()) {
      args.push("--prefix", prefix.trim());
    }
    const jsonAttempt = await execa("npx", [...args, "--format", "json"], {
      cwd,
    }).catch(() => null);
    if (jsonAttempt) return parseKvKeyList(jsonAttempt.stdout);

    const fallback = await execa("npx", args, { cwd });
    return parseKvKeyList(fallback.stdout);
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
