import { createJiti } from "jiti";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import type { AuthStrategy, IdentityConfig } from "@kalphq/sdk";

export interface LoadedProjectConfig {
  path: string;
  raw: Record<string, unknown>;
}

export interface RuntimeIdentityStrategyConfig {
  type: "jwks" | "symmetric" | "apiKey";
  jwksUrl?: string;
  issuer?: string;
  audience?: string;
  secretEnvKey?: string;
  headerName?: string;
  envKey?: string;
}

export interface RuntimeIdentityConfig {
  enforceGlobalAuth: boolean;
  identityId: string | null;
  strategy: RuntimeIdentityStrategyConfig | null;
}

export interface ProjectConfigAuthRequirement {
  envKey: string;
  reason: string;
}

function normalizeStrategy(
  strategy: AuthStrategy | undefined,
): RuntimeIdentityStrategyConfig | null {
  if (!strategy) return null;
  if (strategy.type === "jwks") {
    return {
      type: "jwks",
      jwksUrl: strategy.jwksUrl,
      issuer: strategy.issuer,
      audience: strategy.audience,
    };
  }
  if (strategy.type === "symmetric") {
    return {
      type: "symmetric",
      secretEnvKey: strategy.secretEnvKey,
    };
  }
  return {
    type: "apiKey",
    headerName: strategy.headerName,
    envKey: strategy.envKey,
  };
}

export async function loadProjectConfig(cwd: string): Promise<LoadedProjectConfig> {
  const configPath = resolve(join(cwd, "kalp.config.ts"));
  await access(configPath, constants.F_OK);
  const jiti = createJiti(cwd, { interopDefault: true });
  const moduleValue = (await jiti.import(configPath)) as
    | { default?: Record<string, unknown> }
    | Record<string, unknown>;
  const raw =
    moduleValue && typeof moduleValue === "object" && "default" in moduleValue
      ? ((moduleValue.default ?? moduleValue) as Record<string, unknown>)
      : (moduleValue as Record<string, unknown>);
  return { path: configPath, raw };
}

export function resolveRuntimeIdentityConfig(
  rawConfig: Record<string, unknown>,
): RuntimeIdentityConfig {
  const identity =
    rawConfig.identity && typeof rawConfig.identity === "object"
      ? (rawConfig.identity as IdentityConfig)
      : undefined;
  const enforceGlobalAuth =
    typeof rawConfig.enforceGlobalAuth === "boolean"
      ? rawConfig.enforceGlobalAuth
      : true;

  return {
    enforceGlobalAuth,
    identityId:
      identity && typeof identity.id === "string" && identity.id.length > 0
        ? identity.id
        : null,
    strategy: normalizeStrategy(identity?.strategy),
  };
}

export function resolveIdentityAuthRequirements(
  identity: RuntimeIdentityConfig,
): ProjectConfigAuthRequirement[] {
  if (!identity.strategy) return [];

  if (identity.strategy.type === "symmetric") {
    return [
      {
        envKey: identity.strategy.secretEnvKey?.trim() || "JWT_SIGNING_SECRET",
        reason: "symmetric JWT validation",
      },
    ];
  }

  if (identity.strategy.type === "apiKey") {
    const envKey = identity.strategy.envKey?.trim();
    if (!envKey) {
      return [
        {
          envKey: "KALP_API_KEY",
          reason: "apiKey strategy (default env key)",
        },
      ];
    }
    return [{ envKey, reason: "apiKey strategy" }];
  }

  return [];
}
