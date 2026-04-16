// @ts-nocheck
// Superseded by static template at templates/agents/minimal/ (used via giget)

export const minimal: Template = {
  id: "minimal",
  secrets: [],
  files: (agent) => [
    {
      path: `kalp/agents/${agent}/index.ts`,
      content: `import { asAgentId, defineAgent } from "@kalphq/sdk";

export default defineAgent({
  id: asAgentId("${agent}"),
  name: "${agent}",

  async onMessage(message, ctx) {
    return { text: "Hello from ${agent}!" };
  },
});
`,
    },
    {
      path: `kalp/agents/${agent}/steps/.gitkeep`,
      content: "",
    },
    {
      path: `kalp/agents/${agent}/tools/.gitkeep`,
      content: "",
    },
    {
      path: `kalp/agents/${agent}/webhooks/.gitkeep`,
      content: "",
    },
    {
      path: `kalp/agents/${agent}/signals/.gitkeep`,
      content: "",
    },
  ],
};
