# @kalphq/sdk

The official SDK for building Kalp agents in TypeScript.

## Install

```bash
pnpm add @kalphq/sdk
```

## Mental model

- **Contracts** are the public API of an agent.
- **Listeners** are local request/reply orchestration inside the same agent.
- **Tools** are reusable executable units.
- **Hooks** define lifecycle entrypoints (`init`, `tick`, `message`).
- **State** is declared with Zod in `defineAgent` and becomes a typed mutable document on `ctx.state`.

## Example

```ts
import {
  defineAgent,
  defineContract,
  defineHook,
  defineListener,
  defineTool,
  z,
} from "@kalphq/sdk";

export const agentState = z.object({
  status: z.enum(["idle", "processing"]).default("idle"),
  processedCount: z.number().default(0),
});

export type AgentState = z.infer<typeof agentState>;

const approvalRequested = defineListener<AgentState>({
  event: "approval_requested",
  inputSchema: z.object({ score: z.number() }),
  outputSchema: z.object({ approved: z.boolean() }),
  async handler(payload, ctx) {
    ctx.state.processedCount += 1;
    return { approved: payload.score > 80 };
  },
});

const summarizeTool = defineTool<AgentState>({
  id: "summarize_tool",
  inputSchema: z.object({ text: z.string() }),
  async handler({ text }) {
    return { summary: text.toUpperCase() };
  },
});

const approvalContract = defineContract<AgentState>({
  name: "approval-service",
  inputSchema: z.object({ opportunityId: z.string() }),
  outputSchema: z.object({ approved: z.boolean() }),
  async handler() {
    return { approved: true };
  },
});

const messageHook = defineHook<AgentState>({
  type: "message",
  async handler(message, ctx) {
    const summary = await ctx.actions.run(summarizeTool, { text: message.text });
    const approval = await ctx.actions.emit(approvalRequested, { score: 91 });
    const external = await ctx.actions.callAgent(approvalContract, {
      opportunityId: message.text,
    });

    return {
      text: approval.approved && external.approved ? summary.summary : "Blocked",
    };
  },
});

export default defineAgent({
  name: "revenue-agent",
  state: agentState,
  contracts: [approvalContract],
  hooks: [messageHook],
});
```

## What's Included

- **Agent Definition** - Declarative agents with state, hooks, contracts, routes, and cron jobs
- **Contracts** - Type-safe public APIs between agents
- **Listeners** - Typed local orchestration with `emit()` and `dispatch()`
- **Tools** - Reusable executable units for agent logic
- **Routes** - HTTP endpoints exposed by the agent
- **Scheduling** - Cron expressions and helper functions
- **Auth / AI / Storage / Memory** - Runtime primitives available through `ctx`

## Learn More

- Documentation: [docs.usekalp.com](https://docs.usekalp.com)
- Website: [usekalp.com](https://usekalp.com)
