import { recordExecution } from "./executions.js";
import { resolveAgentChatCapabilities, resolveRoutingTable } from "./resolvers.js";
import { verifyGatewayAuth } from "./auth.js";

export function getAgentRouting(url) {
  const segments = url.pathname.split("/").filter(Boolean);

  if (segments[0] === "a" && segments[1]) {
    return {
      agentName: segments[1],
      passthroughPath: `/${segments.slice(2).join("/")}` || "/",
    };
  }

  return {
    agentName: segments[0] || "default",
    passthroughPath: `/${segments.slice(1).join("/")}` || "/",
  };
}

function normalizePath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
}

async function resolveAgentAccess(env, agentName, method, pathname) {
  const routes = await resolveRoutingTable(env, agentName);
  const matched = routes.find(
    (route) =>
      route.method.toUpperCase() === method.toUpperCase() &&
      normalizePath(route.path) === normalizePath(pathname),
  );

  if (matched) {
    return { isPublic: Boolean(matched.public), matchedRoute: matched };
  }

  const chat = await resolveAgentChatCapabilities(env, agentName);
  if (normalizePath(pathname) === "/" && chat.supportsChat) {
    return { isPublic: false, matchedRoute: null };
  }

  return { isPublic: false, matchedRoute: null };
}

export async function invokeAgentRuntime(params) {
  const {
    env,
    agentName,
    pathname,
    method,
    headers,
    body,
    requestUrl,
    source,
  } = params;

  const id = env.KALP_RUNTIME_CLOUDFLARE.idFromName(agentName);
  const stub = env.KALP_RUNTIME_CLOUDFLARE.get(id);
  const proxiedUrl = new URL(requestUrl);
  proxiedUrl.pathname = pathname;

  const request = new Request(proxiedUrl.toString(), {
    method,
    headers,
    body,
  });

  return recordExecution(env, {
    agentName,
    source,
    input: {
      pathname,
      method,
    },
    run: async ({ executionId }) => {
      const nextHeaders = new Headers(request.headers);
      nextHeaders.set("x-kalp-agent-name", agentName);
      nextHeaders.set("x-kalp-execution-id", executionId);
      const response = await stub.fetch(
        new Request(request, {
          headers: nextHeaders,
        }),
      );

      const clone = response.clone();
      const text = await clone.text();
      try {
        return JSON.parse(text);
      } catch {
        return { text, status: response.status };
      }
    },
  });
}

export async function forwardToAgentDO(c, request, env) {
  const url = new URL(request.url);
  const { agentName, passthroughPath } = getAgentRouting(url);
  const access = await resolveAgentAccess(
    env,
    agentName,
    request.method,
    passthroughPath === "/" ? "/" : passthroughPath,
  );

  let identity = null;
  if (!access.isPublic) {
    identity = await verifyGatewayAuth(c);
    if (!identity) {
      return c.json({ ok: false, error: "Unauthorized" }, 401);
    }
  }

  const headers = new Headers(request.headers);
  headers.set("x-kalp-route-public", String(access.isPublic));
  if (identity?.userId) {
    headers.set("x-kalp-auth-user-id", identity.userId);
    headers.set("x-kalp-auth-provider-id", identity.providerId ?? "identity");
    headers.set("x-kalp-auth-claims", JSON.stringify(identity.claims ?? {}));
  }

  const result = await invokeAgentRuntime({
    env,
    agentName,
    pathname: passthroughPath,
    method: request.method,
    headers,
    body: request.body,
    requestUrl: request.url,
    source: {
      type: "http",
      method: request.method.toUpperCase(),
      path: passthroughPath,
    },
  });

  return c.json({ ok: true, executionId: result.executionId, result: result.output });
}
