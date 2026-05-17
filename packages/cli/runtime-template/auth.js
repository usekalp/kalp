import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import identityConfig from "./identity.config.json";
import mapIdentity from "./identity.map.mjs";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "./constants.js";
import { extractBearerToken, normalizeHeaderRecord } from "./shared.js";

const JWKS_RESOLVER_CACHE = new Map();

function toMappedIdentity(payload, request) {
  const rawHeaders = normalizeHeaderRecord(request);
  try {
    const mapped = mapIdentity(payload, rawHeaders);
    if (
      mapped &&
      typeof mapped === "object" &&
      typeof mapped.userId === "string" &&
      mapped.userId.length > 0
    ) {
      return {
        userId: mapped.userId,
        email: mapped.email,
        name: mapped.name,
        claims:
          mapped.claims && typeof mapped.claims === "object" ? mapped.claims : {},
      };
    }
  } catch {
    // ignore mapping issues and fall back to subject
  }

  const sub =
    payload && typeof payload === "object" && typeof payload.sub === "string"
      ? payload.sub
      : "anonymous";
  return { userId: sub, claims: {} };
}

function resolveSymmetricSecret(env, secretEnvKey) {
  const key =
    secretEnvKey && secretEnvKey.trim()
      ? secretEnvKey.trim()
      : "JWT_SIGNING_SECRET";
  const selected = env[key];
  if (typeof selected === "string" && selected.trim()) return selected.trim();
  if (key !== "JWT_SIGNING_SECRET") {
    const fallback = env.JWT_SIGNING_SECRET;
    if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  }
  return null;
}

function getJwksResolver(jwksUrl) {
  const cached = JWKS_RESOLVER_CACHE.get(jwksUrl);
  if (cached) return cached;
  const resolver = createRemoteJWKSet(new URL(jwksUrl));
  JWKS_RESOLVER_CACHE.set(jwksUrl, resolver);
  return resolver;
}

export async function readSession(c) {
  const secret = c.env.KALP_SECRET_KEY;
  if (!secret) return null;

  const username = await getSignedCookie(c, secret, SESSION_COOKIE_NAME);
  if (!username || typeof username !== "string") return null;
  return { username };
}

export async function requireSession(c, next) {
  const session = await readSession(c);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("session", session);
  return next();
}

export async function verifyGatewayAuth(c) {
  const enforce = identityConfig?.enforceGlobalAuth !== false;
  if (!enforce) {
    return { userId: "anonymous", claims: {}, providerId: "none" };
  }

  const token = extractBearerToken(c.req.header("Authorization"));

  const serviceKey = c.env.KALP_SERVICE_KEY?.trim();
  if (serviceKey && token && token === serviceKey) {
    return {
      userId: "service-admin",
      providerId: "service-key",
      claims: { role: "service_admin", service: true },
    };
  }

  const strategy = identityConfig?.strategy;
  if (!strategy) return null;

  try {
    if (strategy.type === "jwks") {
      if (!token || !strategy.jwksUrl) return null;
      const resolver = getJwksResolver(strategy.jwksUrl);
      const options = {};
      if (strategy.issuer) options.issuer = strategy.issuer;
      if (strategy.audience) options.audience = strategy.audience;
      const { payload } = await jwtVerify(token, resolver, options);
      return {
        ...toMappedIdentity(payload, c.req.raw),
        providerId: identityConfig.identityId ?? "identity",
      };
    }

    if (strategy.type === "symmetric") {
      if (!token) return null;
      const secret = resolveSymmetricSecret(c.env, strategy.secretEnvKey);
      if (!secret) return null;
      const encoded = new TextEncoder().encode(secret);
      const { payload } = await jwtVerify(token, encoded, {
        algorithms: ["HS256"],
      });
      return {
        ...toMappedIdentity(payload, c.req.raw),
        providerId: identityConfig.identityId ?? "identity",
      };
    }

    if (strategy.type === "apiKey") {
      const headerName = (strategy.headerName || "x-api-key").toLowerCase();
      const envKey = strategy.envKey || "KALP_API_KEY";
      const expected =
        typeof c.env[envKey] === "string" ? c.env[envKey].trim() : "";
      if (!expected) return null;
      const provided =
        c.req.header(headerName)?.trim() ??
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

export async function handleStudioLogin(c) {
  const secret = c.env.KALP_SECRET_KEY;
  const password = c.env.KALP_STUDIO_PASSWORD;
  const adminUser = c.env.KALP_STUDIO_ADMIN_USER || "admin";

  if (!secret || !password) {
    return c.json({ error: "Studio auth is not configured." }, 500);
  }

  const body = await c.req
    .json()
    .catch(() => ({ username: undefined, password: undefined }));
  const username = body.username || adminUser;

  if (username !== adminUser || body.password !== password) {
    return c.json({ error: "Invalid credentials." }, 401);
  }

  const isSecure = new URL(c.req.url).protocol === "https:";
  await setSignedCookie(c, SESSION_COOKIE_NAME, username, secret, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return c.json({ ok: true, user: { username } });
}

export async function handleStudioLogout(c) {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
}
