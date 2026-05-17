import { Hono } from "hono";
import agentsSnapshot from "./agents.snapshot.json";
import { withCors } from "./shared.js";
import { CORS_HEADERS } from "./constants.js";
import { serveStudioRequest } from "./assets.js";
import { registerStudioRoutes } from "./studio-routes.js";
export { AgentDurableObject } from "./durable-object.js";

const app = new Hono();

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  await next();
  c.res = withCors(c.res);
});

registerStudioRoutes(app, agentsSnapshot);

app.get("/studio", (c) => c.redirect("/studio/", 308));

app.get("/studio/*", async (c) => {
  if (c.env.KALP_STUDIO_DEV_ORIGIN) {
    const requestUrl = new URL(c.req.url);
    const targetUrl = new URL(
      requestUrl.pathname + requestUrl.search,
      c.env.KALP_STUDIO_DEV_ORIGIN,
    );
    return c.redirect(targetUrl.toString(), 307);
  }
  return serveStudioRequest(c.env, c.req.raw);
});

app.get("/", async (c) => {
  if (c.env.KALP_STUDIO_DEV_ORIGIN) {
    return c.redirect("/studio/", 308);
  }
  return c.redirect("/studio/", 308);
});

app.notFound(async (c) => {
  if (c.req.path.startsWith("/api/internal")) {
    return c.json({ error: "Not found" }, 404);
  }
  return serveStudioRequest(c.env, c.req.raw);
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
