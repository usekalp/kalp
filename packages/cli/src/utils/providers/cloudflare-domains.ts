import { readFile } from "node:fs/promises";
import { execa } from "execa";

export function findWorkerUrl(output: string): string | null {
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

export async function resolveCustomDomains(params: {
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
