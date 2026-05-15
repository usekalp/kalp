import { z } from "zod";
import { defineStep, defineTool, defineAgent, defineRoute } from "@kalphq/sdk";

// Step that uses date primitive
export const dateStep = defineStep({
  id: "date_step",
  inputSchema: z.object({ timezone: z.string().optional() }),
  outputSchema: z.object({ timestamp: z.number(), iso: z.string() }),
  async handler(_input, ctx) {
    // Use deterministic date primitive
    const timestamp = ctx.date.now();
    const iso = ctx.date.toISOString();
    return { timestamp, iso };
  },
});

// Step that uses math primitive
export const mathStep = defineStep({
  id: "math_step",
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ rounded: z.number(), random: z.number() }),
  async handler(input, ctx) {
    // Use deterministic math primitives
    const rounded = ctx.math.round(input.value);
    const random = ctx.math.random(); // Deterministic in replay
    return { rounded, random };
  },
});

// Step that uses multiple math operations
export const mathAdvancedStep = defineStep({
  id: "math_advanced",
  inputSchema: z.object({ values: z.array(z.number()) }),
  outputSchema: z.object({
    max: z.number(),
    min: z.number(),
    floor: z.number(),
    sqrt: z.number(),
  }),
  async handler(input, ctx) {
    const max = ctx.math.max(...input.values);
    const min = ctx.math.min(...input.values);
    const floor = ctx.math.floor(input.values[0] || 0);
    const sqrt = ctx.math.sqrt(input.values[0] || 0);
    return { max, min, floor, sqrt };
  },
});

// Tool that uses date and math
export const analyticsTool = defineTool({
  id: "analytics_tool",
  inputSchema: z.object({ data: z.array(z.number()) }),
  async handler(input, ctx) {
    const timestamp = ctx.date.now();
    const avg = input.data.reduce((a, b) => a + b, 0) / input.data.length;
    const max = ctx.math.max(...input.data);
    const min = ctx.math.min(...input.data);
    return { timestamp, avg, max, min, count: input.data.length };
  },
});

// Tool that demonstrates MCP access pattern
export const mcpTool = defineTool({
  id: "mcp_tool",
  inputSchema: z.object({
    server: z.string(),
    tool: z.string(),
    input: z.unknown(),
  }),
  async handler(input, ctx) {
    // MCP is accessed via proxy: ctx.mcp[serverName][toolName](input)
    // This will emit an event but throw in core (MCP requires platform implementation)
    try {
      // Example: ctx.mcp.myServer.myTool({ query: "test" })
      const mcpServer = (ctx.mcp as any)[input.server];
      if (!mcpServer) {
        return { error: `MCP server '${input.server}' not available` };
      }
      const result = await mcpServer[input.tool](input.input);
      return { result };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

// Route for primitives testing
export const primitivesRoute = defineRoute({
  id: "GET:/api/primitives",
  method: "GET",
  path: "/api/primitives",
  async handler({ req: _req, res: _res, ctx }) {
    const timestamp = ctx.date.now();
    const random = ctx.math.random();
    return { timestamp, random, message: "primitives working" };
  },
});

// Agent that tests all new primitives
export default defineAgent({
  name: "primitives-test-agent",
  description: "An agent that tests date, math, and MCP primitives",
  routes: [primitivesRoute],
  async onMessage(_message, ctx) {
    // Demonstrate all primitives in onMessage
    const timestamp = ctx.date.now();
    const iso = ctx.date.toISOString();
    const random = ctx.math.random();
    const rounded = ctx.math.round(3.14159);

    ctx.log.info("Primitives test executed", { timestamp, random });

    return {
      text: "primitives test complete",
      data: { timestamp, iso, random, rounded },
    };
  },
});
