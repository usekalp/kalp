import { z } from "zod";
import {
  defineAgent,
  defineTool,
  defineHook,
  defineRouteFor,
} from "@kalphq/sdk";

export const stateSchema = z.object({ ticks: z.number().default(0) });

export const dateTool = defineTool<z.infer<typeof stateSchema>>({
  id: "date_tool",
  inputSchema: z.object({}),
  async handler(_input, ctx) {
    return { iso: ctx.time.toISOString() };
  },
});

export const mathTool = defineTool<z.infer<typeof stateSchema>>({
  id: "math_tool",
  inputSchema: z.object({ value: z.number() }),
  async handler(input, _ctx) {
    return { rounded: Math.round(input.value), random: Math.random() };
  },
});

export const primitivesRoute = defineRouteFor<z.infer<typeof stateSchema>>()({
  id: "primitives_route",
  method: "GET",
  path: "/api/primitives",
  async handler() {
    return { ok: true };
  },
});

export const messageHook = defineHook<z.infer<typeof stateSchema>>({
  type: "message",
  async handler(message) {
    return { message: { role: "assistant" as const, content: message.content }, done: true };
  },
});

export default defineAgent({
  name: "primitives-test-agent",
  state: stateSchema,
  routes: [primitivesRoute],
  hooks: [messageHook],
});
