import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IdentityConfig, MappedIdentity } from "./types";

const JWKS_RESOLVER_CACHE = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

export function loadIdentityConfig(
  env: Record<string, unknown>,
): IdentityConfig {
  const raw = env.KALP_IDENTITY_CONFIG as string | undefined;
  if (!raw) {
    return { strategy: null, enforceGlobalAuth: true };
  }
  try {
    return JSON.parse(raw) as IdentityConfig;
  } catch {
    return { strategy: null, enforceGlobalAuth: true };
  }
}

export function extractBearerToken(
  authorization: string | null | undefined,
): string | null {
  if (!authorization) return null;
  const value = authorization.trim();
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  const token = match[1].trim();
  return token || null;
}

function resolveSymmetricSecret(
  env: Record<string, unknown>,
  secretEnvKey?: string,
): string | null {
  const key = secretEnvKey?.trim() || "JWT_SIGNING_SECRET";
  const selected =
    typeof env[key] === "string" ? (env[key] as string).trim() : "";
  if (selected) return selected;
  if (key !== "JWT_SIGNING_SECRET") {
    const fallback =
      typeof env.JWT_SIGNING_SECRET === "string"
        ? (env.JWT_SIGNING_SECRET as string).trim()
        : "";
    if (fallback) return fallback;
  }
  return null;
}

function getJwksResolver(
  jwksUrl: string,
): ReturnType<typeof createRemoteJWKSet> {
  const cached = JWKS_RESOLVER_CACHE.get(jwksUrl);
  if (cached) return cached;
  const resolver = createRemoteJWKSet(new URL(jwksUrl));
  JWKS_RESOLVER_CACHE.set(jwksUrl, resolver);
  return resolver;
}

function toMappedIdentity(
  payload: Record<string, unknown>,
  request: Request,
  identityConfig: IdentityConfig,
): MappedIdentity {
  const rawHeaders: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    rawHeaders[key.toLowerCase()] = value;
  }

  if (identityConfig.identityId) {
    try {
      const mapModule = identityConfig.identityId;
      if (
        typeof (globalThis as Record<string, unknown>)[mapModule] === "function"
      ) {
        const mapped = (
          (globalThis as Record<string, unknown>)[mapModule] as (
            p: Record<string, unknown>,
            h: Record<string, string>,
          ) => Record<string, unknown>
        )(payload, rawHeaders);
        if (
          mapped &&
          typeof mapped === "object" &&
          typeof mapped.userId === "string" &&
          mapped.userId.length > 0
        ) {
          return {
            userId: mapped.userId,
            email: mapped.email as string | undefined,
            name: mapped.name as string | undefined,
            claims:
              mapped.claims && typeof mapped.claims === "object"
                ? (mapped.claims as Record<string, unknown>)
                : {},
            providerId: identityConfig.identityId,
          };
        }
      }
    } catch {
      // ignore mapping issues and fall back to subject
    }
  }

  const sub =
    payload && typeof payload === "object" && typeof payload.sub === "string"
      ? payload.sub
      : "anonymous";
  return { userId: sub, claims: {} };
}

export async function verifyGatewayAuth(
  env: Record<string, unknown>,
  authorization: string | null,
  request: Request,
): Promise<MappedIdentity | null> {
  const identityConfig = loadIdentityConfig(env);
  const enforce = identityConfig.enforceGlobalAuth !== false;
  if (!enforce) {
    return { userId: "anonymous", claims: {}, providerId: "none" };
  }

  const token = extractBearerToken(authorization);

  const serviceKey =
    typeof env.KALP_SERVICE_KEY === "string"
      ? (env.KALP_SERVICE_KEY as string).trim()
      : "";
  if (serviceKey && token && token === serviceKey) {
    return {
      userId: "service-admin",
      providerId: "service-key",
      claims: { role: "service_admin", service: true },
    };
  }

  const strategy = identityConfig.strategy;
  if (!strategy) return null;

  try {
    if (strategy.type === "jwks") {
      if (!token || !strategy.jwksUrl) return null;
      const resolver = getJwksResolver(strategy.jwksUrl);
      const options: Record<string, unknown> = {};
      if (strategy.issuer) options.issuer = strategy.issuer;
      if (strategy.audience) options.audience = strategy.audience;
      const { payload } = await jwtVerify(token, resolver, options);
      return {
        ...toMappedIdentity(
          payload as Record<string, unknown>,
          request,
          identityConfig,
        ),
        providerId: identityConfig.identityId ?? "identity",
      };
    }

    if (strategy.type === "symmetric") {
      if (!token) return null;
      const secret = resolveSymmetricSecret(env, strategy.secretEnvKey);
      if (!secret) return null;
      const encoded = new TextEncoder().encode(secret);
      const { payload } = await jwtVerify(token, encoded, {
        algorithms: ["HS256"],
      });
      return {
        ...toMappedIdentity(
          payload as Record<string, unknown>,
          request,
          identityConfig,
        ),
        providerId: identityConfig.identityId ?? "identity",
      };
    }

    if (strategy.type === "apiKey") {
      const headerName = (strategy.headerName || "x-api-key").toLowerCase();
      const envKey = strategy.envKey || "KALP_API_KEY";
      const expected =
        typeof env[envKey] === "string" ? (env[envKey] as string).trim() : "";
      if (!expected) return null;
      const provided =
        request.headers.get(headerName)?.trim() ??
        (headerName === "authorization" ? token : null);
      if (!provided || provided !== expected) return null;
      return {
        userId: "api-key-client",
        providerId: identityConfig.identityId ?? "identity",
        claims: { role: "api_key" },
      };
    }
  } catch {
    return null;
  }

  return null;
}