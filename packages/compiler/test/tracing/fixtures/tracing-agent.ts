import { z } from "zod";
import {
  defineAgent,
  defineTool,
  defineHook,
} from "@kalphq/sdk";
import { seconds } from "@kalphq/sdk";

export const stateSchema = z.object({ count: z.number().default(0) });

export const chatTool = defineTool<z.infer<typeof stateSchema>>({
  id: "chat_tool",
  inputSchema: z.object({ message: z.string() }),
  async handler(input, ctx) {
    const response = await ctx.ai.generate(input.message);
    ctx.log.info("Tool executed");
    ctx.state.count++;
    return { response };
  },
});

export const dataTool = defineTool<z.infer<typeof stateSchema>>({
  id: "data_tool",
  inputSchema: z.object({ key: z.string() }),
  async handler(input, ctx) {
    await ctx.actions.sleep(seconds(5));
    ctx.log.debug("data retrieved");
    return { key: input.key };
  },
});

export const tickHook = defineHook<z.infer<typeof stateSchema>>({
  type: "tick",
  async handler(ctx) {
    ctx.log.info("tick executed");
    ctx.state.count++;
  },
});

export default defineAgent({
  name: "tracing-agent",
  state: stateSchema,
  hooks: [tickHook],
});