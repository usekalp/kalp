<div align="center">

# Kalp 🦋

**The Production Runtime for AI Agents.**

[![NPM Version](https://img.shields.io/npm/v/create-kalp?style=flat-square&color=blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square&logo=typescript)](#)
[![Edge Ready](https://img.shields.io/badge/Deploy-Cloudflare-F6821F?style=flat-square&logo=cloudflare)](#)

</div>

Building an AI Agent in a local Python/Node script is easy. **Running it reliably in production is a nightmare.** It usually requires patching together Redis, queues, cron jobs, database migrations, and a complex DevOps pipeline just to keep the agent's state alive.

**Kalp fixes this.** Write your agent logic in pure TypeScript. We compile it into a deterministic, event-sourced state machine that runs natively at the Edge.

No infrastructure boilerplate. Just code.

---

# 🤯 The Magic

How do you make an AI agent run a task, safely sleep for 24 hours, and then collaborate with another agent without losing memory or locking up a server?

In Kalp, it's just standard, sequential TypeScript:

```ts
import { defineAgent } from "@kalphq/sdk";
import { WriterContract } from "./contracts";

export default defineAgent({
  name: "writer",
  contract: WriterContract,

  async onMessage({ topic }, ctx) {
    ctx.memory.set("topic", topic);

    const draft = await ctx.ai.generate({
      model: "openai/gpt-4o",
      prompt: `Write an article about ${topic}`
    });

    await ctx.actions.waitUntil(ctx.date.add("24h"));

    const feedback = await ctx.agents.call("reviewer", {
      document: draft
    });

    return { success: true, draft, feedback };
  }
});
```

---

# ⚡ Everything You Need to Ship

Kalp provides a complete, opinionated stack so you can focus exclusively on your agent's behavior.

## 🏗️ Architecture & Engine

### Durable Execution
Powered by Event Sourcing. Agents can pause for seconds or months without dropping state.

### Agent Swarms & RPC
Build multi-agent systems effortlessly with `ctx.agents.call()`.

### Contracts (Zod)
Define strict input/output schemas. Kalp ensures your agents never hallucinate bad JSON.

### Built-in REST API
Every agent automatically exposes a secure REST API based on its Contract. No routing boilerplate needed.

### Cron Scheduler
Native support for recurring tasks (`onTick`) tied directly to your agent's state.

---

## 🧠 AI & State

### Zero-Config Memory
Every agent gets an isolated SQLite-backed key-value store (`ctx.memory`) out of the box.

### Bring Your Own Key (BYOK)
Unified AI primitives (`ctx.ai`). Use OpenAI, Anthropic, or local models without changing your business logic.

---

## 🚀 Platform & Operations

### Deploy to Your Own Cloudflare
No vendor lock-in. Push directly to your own Cloudflare account to leverage Edge computing (Durable Objects).

### Time-Travel Replayer UI
Debug like a wizard. Inspect every state change, LLM call, and execution step visually.

### Admin Panel
Built-in dashboard to monitor your swarms, view logs, and manage agent fleets.

### Native Auth
Secure your agent endpoints and internal APIs from day one.

---

# 🏁 Quick Start

Spin up your first agent in seconds using our interactive CLI:

```bash
npx create-kalp@latest
```

Deploy it to the Edge:

```bash
kalp push
```

Your agent is now alive, stateful, and reachable via secure webhooks.

---

# 🌐 Ecosystem & Links

- Website: `usekalp.com`
- Documentation: `docs.usekalp.com`
- Community: Twitter / X `x.com/usekalp`
