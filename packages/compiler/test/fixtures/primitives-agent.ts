import { z } from "zod";
import { defineAgent, defineTool, defineHook, defineRoute } from "@kalphq/sdk";

export const stateSchema = z.object({ ticks: z.number().default(0) });

export const dateTool = defineTool<z.infer<typeof stateSchema>>({
  id: "date_tool",
  inputSchema: z.object({}),
  async handler(_input, ctx) {
    return { iso: ctx.date.toISOString() };
  },
});

export const mathTool = defineTool<z.infer<typeof stateSchema>>({
  id: "math_tool",
  inputSchema: z.object({ value: z.number() }),
  async handler(input, ctx) {
    return { rounded: Math.round(input.value), random: ctx.math.random() };
  },
});

export const primitivesRoute = defineRoute<z.infer<typeof stateSchema>>({
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
    return { text: message.text };
  },
});

export default defineAgent({
  name: "primitives-test-agent",
  state: stateSchema,
  routes: [primitivesRoute],
  hooks: [messageHook],
});
