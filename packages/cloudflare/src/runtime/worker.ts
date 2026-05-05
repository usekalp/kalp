const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    // Agent name is the first path segment (e.g. /myAgent/...)
    const segments = url.pathname.split("/").filter(Boolean);
    const agentName = segments[0] || "default";

    const id = env.KALP_RUNTIME_CLOUDFLARE.idFromName(agentName);
    const stub = env.KALP_RUNTIME_CLOUDFLARE.get(id);

    const response = await stub.fetch(request);

    // WebSocket upgrades pass through directly
    if (response.status === 101) return response;

    // Inject CORS headers for HTTP responses
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
} satisfies ExportedHandler<Env>;
