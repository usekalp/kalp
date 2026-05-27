import { readFile, writeFile } from "node:fs/promises";
import { extractEnvName } from "@kalphq/sdk";
import type { RuntimeIdentityConfig } from "@/utils/project-config";

export async function injectRuntimeConfigs(params: {
  wranglerConfigPath: string;
  aiRaw: unknown;
  identityConfig: RuntimeIdentityConfig;
  mcpRaw: unknown;
  envMap: Record<string, string>;
  cloudflareAccountId?: string;
}): Promise<void> {
  const { wranglerConfigPath, aiRaw, identityConfig, mcpRaw, envMap, cloudflareAccountId } = params;

  const config = JSON.parse(
    await readFile(wranglerConfigPath, "utf-8"),
  ) as Record<string, unknown>;
  const vars = (config.vars ?? {}) as Record<string, string>;

  // AI runtime config
  if (aiRaw && typeof aiRaw === "object") {
    const aiObj = aiRaw as Record<string, unknown>;
    if (aiObj.models && typeof aiObj.models === "object") {
      const aiPayload: Record<string, unknown> = { models: aiObj.models };
      if (typeof aiObj.gatewayId === "string") aiPayload.gatewayId = aiObj.gatewayId;
      if (typeof aiObj.system === "object") aiPayload.system = aiObj.system;
      if (typeof aiObj.fallback === "object") aiPayload.fallback = aiObj.fallback;
      vars.KALP_AI_CONFIG = JSON.stringify(aiPayload);
    }
  }

  // Identity runtime config
  vars.KALP_IDENTITY_CONFIG = JSON.stringify(identityConfig);

  // MCP runtime config
  if (mcpRaw && typeof mcpRaw === "object") {
    const mcpRuntimeConfig: Record<string, { url: string; headers?: Record<string, string> }> = {};
    for (const [serverName, input] of Object.entries(mcpRaw as Record<string, unknown>)) {
      let url: string;
      let auth: unknown;

      if (typeof input === "string") {
        url = input;
        auth = undefined;
      } else if (input && typeof input === "object") {
        const obj = input as Record<string, unknown>;
        url = typeof obj.url === "string" ? obj.url : "";
        auth = obj.auth;
      } else {
        continue;
      }

      if (!url) continue;

      const headers: Record<string, string> = {};
      if (typeof auth === "string") {
        const envName = extractEnvName(auth);
        const token = envName ? envMap[envName]?.trim() : undefined;
        if (token) headers["authorization"] = `Bearer ${token}`;
      } else if (auth && typeof auth === "object") {
        const authObj = auth as Record<string, unknown>;
        if (authObj.type === "bearer" && typeof authObj.token === "string") {
          const envName = extractEnvName(authObj.token);
          const token = envName ? envMap[envName]?.trim() : (authObj.token || undefined);
          if (token) headers["authorization"] = `Bearer ${token}`;
        } else if (authObj.type === "headers" && authObj.headers && typeof authObj.headers === "object") {
          for (const [hk, hv] of Object.entries(authObj.headers as Record<string, unknown>)) {
            if (typeof hv === "string") {
              const envName = extractEnvName(hv);
              headers[hk] = envName ? (envMap[envName]?.trim() ?? hv) : hv;
            }
          }
        }
      }

      mcpRuntimeConfig[serverName] = {
        url,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      };
    }
    if (Object.keys(mcpRuntimeConfig).length > 0) {
      vars.KALP_MCP_CONFIG = JSON.stringify(mcpRuntimeConfig);
    }
  }

  if (cloudflareAccountId) {
    vars.CLOUDFLARE_ACCOUNT_ID = cloudflareAccountId;
  }

  config.vars = vars;
  await writeFile(
    wranglerConfigPath,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf-8",
  );
}
