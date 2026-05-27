import { Hono } from "hono";
import { createStudioApp } from "@/studio/routes";
import { KalpAgent } from "@/agent/kalp-agent";

export { KalpAgent, KalpAgent as AgentDurableObject };

type RuntimeBindings = Env;

const app = new Hono<{
  Bindings: RuntimeBindings;
}>();

const studioApp = createStudioApp();

app.route("/", studioApp);

export default app;