import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import agentsSnapshot from "./agents.snapshot.json";
import identityConfig from "./identity.config.json";
import mapIdentity from "./identity.map.mjs";

const SESSION_COOKIE_NAME = "kalp_studio_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const JWKS_RESOLVER_CACHE = new Map();

function extractBearerToken(authorization) {
  if (!authorization) return null;
  const value = authorization.trim();
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) return null;
  const token = match[1].trim();
  return token || null;
}

function normalizeHeaderRecord(request) {
  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }
  return headers;
}

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
  } catch {}

  const sub =
    payload && typeof payload === "object" && typeof payload.sub === "string"
      ? payload.sub
      : "anonymous";
  return { userId: sub, claims: {} };
}

function resolveSymmetricSecret(env, secretEnvKey) {
  const key = secretEnvKey && secretEnvKey.trim() ? secretEnvKey.trim() : "JWT_SIGNING_SECRET";
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

function withCors(response) {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function resolveStudioAssetPath(pathname) {
  if (pathname === "/studio" || pathname === "/studio/") return "";
  const stripped = pathname.replace(/^\/studio\//, "");
  return stripped || "";
}

async function serveAsset(env, assetPath, request) {
  const assetUrl = new URL(request.url);
  assetUrl.hostname = "assets.local";
  assetUrl.pathname = assetPath ? `/${assetPath.replace(/^\/+/, "")}` : "/";
  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

function shouldTreatAsStaticAsset(assetPath) {
  if (!assetPath) return false;
  if (assetPath.startsWith("assets/")) return true;
  if (assetPath === "favicon.ico") return true;
  if (assetPath === "manifest.json") return true;
  if (assetPath === "robots.txt") return true;
  return assetPath.includes(".");
}

function inferRuntimeMode(c) {
  const host = new URL(c.req.url).hostname.toLowerCase();

  const explicitEnv = c.env.KALP_ENV;
  if (explicitEnv === "remote") return "remote";
  if (explicitEnv === "local") return "local";

  const runtimeMode = c.env.KALP_RUNTIME_MODE;
  if (runtimeMode === "local") return "local";
  if (runtimeMode === "remote") return "remote";

  const hasKvBinding = !!c.env.KALP_MANIFESTS;
  const isWranglerLocal =
    host === "localhost" || host === "127.0.0.1" || host === "::1";

  if (hasKvBinding && !isWranglerLocal) return "remote";
  if (isWranglerLocal) return "local";

  if (host.endsWith(".workers.dev") || host.endsWith(".pages.dev")) {
    return "remote";
  }

  const cfMeta = c.req.raw && c.req.raw.cf;
  if (cfMeta) return "remote";

  return agentsSnapshot.mode === "remote" ? "remote" : "local";
}

async function readSession(c) {
  const secret = c.env.KALP_SECRET_KEY;
  if (!secret) return null;

  const username = await getSignedCookie(c, secret, SESSION_COOKIE_NAME);
  if (!username || typeof username !== "string") return null;
  return { username };
}

async function requireSession(c, next) {
  const session = await readSession(c);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("session", session);
  return next();
}

async function verifyGatewayAuth(c) {
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
      if (!token) return null;
      if (!strategy.jwksUrl) return null;
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

function mapIndexToStudioAgents(entries) {
  return entries.map((entry) => ({
    name: entry.name,
    label: entry.label,
    tags: entry.tags ?? [],
    environment: "remote",
    status: entry.workerUrl ? "online" : "offline",
    hash: entry.hash ?? null,
    version: entry.version ?? null,
    versionNumber: entry.versionNumber ?? null,
    lastRemoteHash: entry.hash ?? null,
    lastLocalHash: null,
    workerUrl: entry.workerUrl ?? null,
    localPath: null,
    updatedAt: entry.updatedAt ?? null,
  }));
}

function normalizeIndexEntries(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (item && typeof item === "object" ? item : null))
    .filter(Boolean)
    .map((entry) => ({
      name: typeof entry.name === "string" ? entry.name : "",
      hash: typeof entry.hash === "string" ? entry.hash : undefined,
      version: typeof entry.version === "string" ? entry.version : null,
      versionNumber:
        typeof entry.versionNumber === "number" ? entry.versionNumber : null,
      updatedAt:
        typeof entry.updatedAt === "string" ? entry.updatedAt : undefined,
      workerUrl:
        typeof entry.workerUrl === "string" ? entry.workerUrl : null,
      label: typeof entry.label === "string" ? entry.label : undefined,
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((item) => typeof item === "string")
        : [],
    }))
    .filter((entry) => entry.name.length > 0);
}

async function loadAgentsFromIndexOrPointers(env, requestUrl) {
  const rawIndex = await env.KALP_MANIFESTS.get("agents:index");
  if (rawIndex) {
    try {
      const parsed = normalizeIndexEntries(JSON.parse(rawIndex));
      if (parsed.length > 0) return mapIndexToStudioAgents(parsed);
    } catch {}
  }

  const pointers = [];
  let cursor = undefined;
  do {
    const listed = await env.KALP_MANIFESTS.list({ cursor, limit: 1000 });
    pointers.push(
      ...listed.keys
        .map((item) => item?.name || "")
        .filter((name) => name.endsWith(":latest")),
    );
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  const agentNames = [...new Set(pointers.map((name) => name.slice(0, -7)))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (agentNames.length === 0) return [];

  const origin = new URL(requestUrl).origin.replace(/\/$/, "");
  const agents = [];
  for (const agentName of agentNames) {
    const hash = await env.KALP_MANIFESTS.get(`${agentName}:latest`);
    if (!hash) continue;

    const manifestRaw = await env.KALP_MANIFESTS.get(`${agentName}:${hash}`);
    let metadata = null;
    if (manifestRaw) {
      try {
        const manifest = JSON.parse(manifestRaw);
        metadata =
          manifest && typeof manifest === "object" ? manifest.metadata : null;
      } catch {}
    }

    agents.push({
      name: agentName,
      label:
        metadata && typeof metadata.label === "string"
          ? metadata.label
          : undefined,
      tags:
        metadata &&
        Array.isArray(metadata.tags)
          ? metadata.tags.filter((item) => typeof item === "string")
          : [],
      environment: "remote",
      status: "online",
      hash,
      version: null,
      versionNumber: null,
      lastRemoteHash: hash,
      lastLocalHash: null,
      workerUrl: `${origin}/a/${agentName}`,
      localPath: null,
      updatedAt: null,
    });
  }

  return agents;
}

async function readLatestManifest(env, agentName) {
  const latest = await env.KALP_MANIFESTS.get(`${agentName}:latest`);
  if (!latest) return null;

  const raw = await env.KALP_MANIFESTS.get(`${agentName}:${latest}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function resolveAgentAccess(env, agentName, routeKey) {
  const manifest = await readLatestManifest(env, agentName);
  const metadata = manifest?.metadata || {};
  const routePublic = metadata.routesPublic
    ? metadata.routesPublic[routeKey]
    : undefined;
  const agentPublic = metadata.public ?? false;
  return { isPublic: routePublic !== undefined ? routePublic : agentPublic };
}

export class AgentDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.currentAgentName = null;
    this.currentManifestHash = null;
    this.currentManifest = null;
  }

  async getRuntimeManifest(agentName) {
    const latestHash = await this.env.KALP_MANIFESTS.get(`${agentName}:latest`);
    if (!latestHash) {
      throw new Error(`No manifest pointer found for agent "${agentName}".`);
    }

    if (
      this.currentAgentName === agentName &&
      this.currentManifestHash === latestHash &&
      this.currentManifest
    ) {
      return { hash: latestHash, manifest: this.currentManifest };
    }

    const manifestRaw = await this.env.KALP_MANIFESTS.get(
      `${agentName}:${latestHash}`,
    );
    if (!manifestRaw) {
      throw new Error(
        `Manifest "${agentName}:${latestHash}" not found in KALP_MANIFESTS.`,
      );
    }

    const manifest = JSON.parse(manifestRaw);
    this.currentAgentName = agentName;
    this.currentManifestHash = latestHash;
    this.currentManifest = manifest;
    return { hash: latestHash, manifest };
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    const url = new URL(request.url);
    const agentName = request.headers.get("x-kalp-agent-name") || "default";
    const { hash, manifest } = await this.getRuntimeManifest(agentName);

    const eventType =
      url.pathname === "/" || url.pathname === ""
        ? "onMessage"
        : `route:${url.pathname}`;
    const payload =
      request.method.toUpperCase() === "GET"
        ? Object.fromEntries(url.searchParams)
        : await request.json().catch(() => null);

    return Response.json({
      ok: true,
      result: {
        agentName,
        manifestHash: hash,
        eventType,
        payload,
        entries: Object.keys(manifest.entries || {}),
      },
    });
  }
}

function getAgentRouting(url) {
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments[0] === "a" && segments[1]) {
    return {
      agentName: segments[1],
      passthroughPath: `/${segments.slice(2).join("/")}`,
    };
  }

  return {
    agentName: segments[0] || "default",
    passthroughPath: `/${segments.slice(1).join("/")}`,
  };
}

async function forwardToAgentDO(c, request, env) {
  const url = new URL(request.url);
  const { agentName, passthroughPath } = getAgentRouting(url);
  const routeKey = `${request.method.toUpperCase()}:${passthroughPath === "/" ? "/" : passthroughPath}`;
  const access = await resolveAgentAccess(env, agentName, routeKey);
  let identity = null;
  if (!access.isPublic) {
    identity = await verifyGatewayAuth(c);
    if (!identity) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }
  }

  const id = env.KALP_RUNTIME_CLOUDFLARE.idFromName(agentName);
  const stub = env.KALP_RUNTIME_CLOUDFLARE.get(id);

  const proxiedUrl = new URL(request.url);
  proxiedUrl.pathname = passthroughPath === "/" ? "/" : passthroughPath;
  const headers = new Headers(request.headers);
  headers.set("x-kalp-agent-name", agentName);
  headers.set("x-kalp-route-public", String(access.isPublic));
  if (identity && identity.userId) {
    headers.set("x-kalp-auth-user-id", identity.userId);
    headers.set("x-kalp-auth-provider-id", identity.providerId ?? "identity");
    headers.set("x-kalp-auth-claims", JSON.stringify(identity.claims ?? {}));
  }

  const proxyRequest = new Request(proxiedUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
  });

  return stub.fetch(proxyRequest);
}

const app = new Hono();

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  await next();
  c.res = withCors(c.res);
});

app.post("/api/internal/auth", async (c) => {
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
});

app.get("/api/internal/session", async (c) => {
  const session = await readSession(c);
  if (!session) return c.json({ authenticated: false }, 401);
  return c.json({ authenticated: true, user: session });
});

app.post("/api/internal/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

app.use("/api/internal/agents*", requireSession);
app.use("/api/internal/executions*", requireSession);
app.use("/api/internal/events*", requireSession);

app.get("/api/internal/agents", (c) => {
  const runtimeMode = inferRuntimeMode(c);

  if (runtimeMode === "remote") {
    return loadAgentsFromIndexOrPointers(c.env, c.req.url).then((agents) => {
      return c.json({
        generatedAt: new Date().toISOString(),
        projectPath: agentsSnapshot.projectPath,
        workerUrl: agentsSnapshot.workerUrl,
        mode: "remote",
        agents,
      });
    });
  }

  return c.json({
    generatedAt: agentsSnapshot.generatedAt,
    projectPath: agentsSnapshot.projectPath,
    workerUrl: agentsSnapshot.workerUrl,
    mode: "local",
    agents: agentsSnapshot.agents,
  });
});

app.get("/api/internal/agents/:agentName", async (c) => {
  const agentName = c.req.param("agentName");
  const runtimeMode = inferRuntimeMode(c);

  if (runtimeMode === "remote") {
    const manifest = await readLatestManifest(c.env, agentName);
    if (!manifest) {
      return c.json({ error: `Agent "${agentName}" not found.` }, 404);
    }

    const metadata = manifest.metadata ?? {};
    return c.json({
      name: metadata.name ?? agentName,
      label: metadata.label,
      tags: metadata.tags ?? [],
      environment: "remote",
      status: "online",
      hash: null,
      version: null,
      versionNumber: null,
      lastRemoteHash: null,
      lastLocalHash: null,
      workerUrl: `${new URL(c.req.url).origin.replace(/\/$/, "")}/a/${agentName}`,
      localPath: null,
      updatedAt: null,
      public: metadata.public ?? false,
      routesPublic: metadata.routesPublic ?? {},
      listeners: metadata.listeners ?? [],
    });
  }

  const agent = agentsSnapshot.agents.find((item) => item.name === agentName);
  if (!agent) {
    return c.json({ error: `Agent "${agentName}" not found.` }, 404);
  }
  return c.json(agent);
});

app.get("/api/internal/executions", (c) => {
  return c.json([]);
});

app.get("/api/internal/events/:executionId", (c) => {
  return c.json([]);
});

app.all("/a/:agentName/*", async (c) => {
  return forwardToAgentDO(c, c.req.raw, c.env);
});

app.all("/a/:agentName", async (c) => {
  return forwardToAgentDO(c, c.req.raw, c.env);
});

app.get("/studio", (c) => c.redirect("/studio/", 308));

app.get("/studio/*", async (c) => {
  const pathname = new URL(c.req.url).pathname;
  const assetPath = resolveStudioAssetPath(pathname);
  if (!shouldTreatAsStaticAsset(assetPath)) {
    return serveAsset(c.env, "", c.req.raw);
  }

  const assetResponse = await serveAsset(c.env, assetPath, c.req.raw);
  if (assetResponse.status !== 404) return assetResponse;
  return serveAsset(c.env, "", c.req.raw);
});

app.get("/", (c) => c.redirect("/studio/", 308));

app.notFound(async (c) => {
  if (c.req.path.startsWith("/api/internal")) {
    return c.json({ error: "Not found" }, 404);
  }
  return serveAsset(c.env, "", c.req.raw);
});

app.onError((error, c) => {
  return c.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    },
    500,
  );
});

export default app;
