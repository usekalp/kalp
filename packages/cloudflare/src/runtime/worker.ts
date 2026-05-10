import { AgentDurableObject } from "./durable-object";
export { AgentDurableObject };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCors(response: Response): Response {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function serveStudio(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/studio") {
    return Response.redirect(`${url.origin}/studio/`, 308);
  }

  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  // SPA fallback
  const indexRequest = new Request(`${url.origin}/studio/index.html`, request);
  return env.ASSETS.fetch(indexRequest);
}

async function handleInternalApi(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/api/internal/executions") {
    return Response.json([]);
  }

  if (/^\/api\/internal\/events\/[^/]+$/.test(url.pathname)) {
    return Response.json([]);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

function getAgentRouting(url: URL): { agentName: string; passthroughPath: string } {
  const segments = url.pathname.split("/").filter(Boolean);

  // Preferred route: /a/:agentName/*
  if (segments[0] === "a" && segments[1]) {
    return {
      agentName: segments[1],
      passthroughPath: `/${segments.slice(2).join("/")}`,
    };
  }

  // Backward compatibility: /:agentName/*
  return {
    agentName: segments[0] || "default",
    passthroughPath: `/${segments.slice(1).join("/")}`,
  };
}

async function forwardToAgentDO(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { agentName, passthroughPath } = getAgentRouting(url);

  const id = env.KALP_RUNTIME_CLOUDFLARE.idFromName(agentName);
  const stub = env.KALP_RUNTIME_CLOUDFLARE.get(id);

  const proxiedUrl = new URL(request.url);
  proxiedUrl.pathname = passthroughPath === "/" ? "/" : passthroughPath;
  const headers = new Headers(request.headers);
  headers.set("x-kalp-agent-name", agentName);

  const proxyRequest = new Request(proxiedUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
  });

  return stub.fetch(proxyRequest);
}

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname.startsWith("/studio")) {
      return withCors(await serveStudio(request, env));
    }

    if (url.pathname.startsWith("/api/internal")) {
      return withCors(await handleInternalApi(request));
    }

    return withCors(await forwardToAgentDO(request, env));
  },
} satisfies ExportedHandler<Env>;

