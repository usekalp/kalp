# @kalphq/sdk

The official SDK for building Kalp agents in TypeScript.

## Install

```bash
pnpm add @kalphq/sdk
```

## What is this?

The SDK provides everything you need to define, configure, and run AI agents with Kalp. It handles durable execution, state management, AI integration, scheduling, and built-in REST APIs - all with full end-to-end type safety.

## Key Concepts

**Agents** are the core unit of your application. Each agent has a contract (schema), handlers for messages and calls, and optional routes, listeners, and cron schedules.

**Contracts** define what an agent can receive, return, and emit. Written with Zod, they become the single source of truth for your entire agent - input validation, output types, and event definitions all derive from one place.

**Context** is what you receive in your handlers. It gives you memory (key-value storage), actions (run steps, emit events, wait, call other agents), AI generation, and deterministic time.

## Example

```ts
import { defineAgent, defineContract, z, bindContract } from "@kalphq/sdk";

const MyContract = defineContract("my-agent", {
  input: z.object({ topic: z.string() }),
  output: z.object({ summary: z.string() }),
  emits: {
    completed: z.object({ summary: z.string() }),
  },
});

const { defineStep } = bindContract(MyContract);

const analyzeTopic = defineStep({
  id: "analyze",
  inputSchema: z.object({ topic: z.string() }),
  outputSchema: z.object({
    keywords: z.array(z.string()),
    sentiment: z.enum(["positive", "neutral", "negative"]),
  }),

  async handler({ topic }) {
    return {
      keywords: [topic, "trending"],
      sentiment: "positive",
    };
  },
});

export default defineAgent({
  name: "my-agent",
  contract: MyContract,

  async onMessage({ topic }, ctx) {
    const result = await ctx.actions.run(analyzeTopic, { topic });

    await ctx.memory.set("last_analysis", result);
    await ctx.actions.emit("completed", { summary: "Done" });

    return { summary: `Analyzed ${topic}` };
  },
});
```

## What's Included

- **Agent Definition** - Define agents with contracts, handlers, routes, listeners, and cron schedules
- **Contracts** - Zod-based schemas for type-safe input/output and event definitions
- **Steps & Tools** - Reusable units of work with full type inference
- **Routes** - Automatic REST endpoints based on your contract
- **Listeners** - Event-driven handlers that react to other agents
- **Memory** - Built-in key-value storage per agent
- **AI Primitives** - Unified interface for OpenAI, Anthropic, OpenRouter, and more
- **Scheduling** - Cron expressions and helper functions
- **Auth** - JWT, API key, and symmetric strategies with identity mapping
- **Errors** - Typed error classes for validation, auth, and not-found scenarios

## Configuration

Create a `kalp.config.ts` in your project root:

```ts
import { defineConfig } from "@kalphq/sdk";

export default defineConfig({
  secrets: ["OPENAI_API_KEY"],
  ai: { provider: "openai" },
  identity: {
    id: "clerk",
    strategy: { type: "jwks", jwksUrl: "https://..." },
    mapIdentity: (payload) => ({ userId: payload.sub }),
  },
  enforceGlobalAuth: true,
});
```

## Learn More

- Documentation: [docs.usekalp.com](https://docs.usekalp.com)
- Website: [usekalp.com](https://usekalp.com)
