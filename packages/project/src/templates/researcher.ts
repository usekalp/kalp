/**
 * Researcher template - AI research assistant with scheduled publishing.
 *
 * @module
 */

import { join } from "node:path";
import type { TemplateDefinition } from "./types";
import { writeTemplateFile } from "./utils";

/**
 * Generate the researcher agent template.
 */
async function generateResearcher(opts: {
  agentName: string;
  cwd: string;
  label?: string;
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  // Derive contract name from agent name (e.g. "my-agent" -> "MyAgent")
  const contractName = agentName
    .replace(/-+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^./, (char: string) => char.toUpperCase());

  // Main agent file
  const agentIndex = [
    'import { defineAgent } from "@kalphq/sdk";',
    'import { deepResearch } from "./steps/deep-research";',
    'import { writeDraft } from "./steps/write-draft";',
    'import { publishToBlog } from "./steps/publish-to-blog";',
    'import { healthRoute } from "./routes/health";',
    'import { onInit } from "./hooks/onInit";',
    'import { ' + contractName + 'Contract } from "./contract/' + agentName + '-contract";',
    "",
    "/**",
    " * Researcher agent that researches topics and schedules blog posts.",
    " */",
    "export default defineAgent({",
    '  name: "' + agentName + '",',
    '  label: "' + (opts.label ?? agentName) + '",',
    "  description: \"AI research assistant with scheduled publishing\",",
    "",
    "  contract: " + contractName + "Contract,",
    "",
    "  systemPrompt: () => {",
    '    return "You are a research assistant. Help users research topics and schedule blog posts.";',
    "  },",
    "",
    "  // Uncomment to add MCP servers for external data sources:",
    "",
    "  onInit,",
    "  routes: [healthRoute],",
    "",
    "  async onMessage(message, ctx) {",
    "    // Research the topic",
    "    const researchData = await ctx.actions.run(deepResearch, {",
    "      topic: message.text,",
    "    });",
    "    // Write the draft",
    "    const draft = await ctx.actions.run(writeDraft, { data: researchData });",
    "    // Schedule for 24 hours later",
    '    const publishTime = ctx.date.add("24h");',
    "    // Pause until the scheduled publish time",
    "    await ctx.actions.waitUntil(publishTime);",
    "    // Publish to blog when the time comes",
    "    await ctx.actions.run(publishToBlog, { content: draft });",
    "",
    "    return {",
    '      text: "Research complete! Publication scheduled for " + ctx.date.timezone("UTC").format("YYYY-MM-DD HH:mm"),',
    "    };",
    "  },",
    "});",
  ].join("\n");

  // Step: deep research
  const deepResearchStep = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineStep } = bindContract(" + contractName + "Contract);",
    "",
    "/**",
    " * Performs deep research on a given topic.",
    " */",
    "export const deepResearch = defineStep({",
    '  id: "deep_research",',
    '  description: "Research a topic thoroughly",',
    "  inputSchema: z.object({ topic: z.string() }),",
    "  outputSchema: z.object({",
    "    findings: z.array(z.string()),",
    "    sources: z.array(z.string()),",
    "    summary: z.string(),",
    "  }),",
    "  handler: async ({ topic }, ctx) => {",
    "    // Research the topic with AI",
    "    const result = await ctx.ai.generate({",
    '      model: "openai/gpt-4o-mini",',
    '      system: "You are a research assistant. Provide detailed findings with sources.",',
    '      prompt: "Research this topic thoroughly: " + topic,',
    "    });",
    "    // Structure the research results",
    "    return {",
    '      findings: result.split("\\n").filter((line) => line.trim()),',
    '      sources: ["https://example.com/source1", "https://example.com/source2"],',
    '      summary: result.slice(0, 200) + "...",',
    "    };",
    "  },",
    "});",
  ].join("\n");

  // Step: write draft
  const writeDraftStep = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineStep } = bindContract(" + contractName + "Contract);",
    "",
    "/**",
    " * Writes a polished draft from research data.",
    " */",
    "export const writeDraft = defineStep({",
    '  id: "write_draft",',
    '  description: "Write a blog post draft from research",',
    "  inputSchema: z.object({",
    "    data: z.object({",
    "      findings: z.array(z.string()),",
    "      sources: z.array(z.string()),",
    "      summary: z.string(),",
    "    }),",
    "  }),",
    "  outputSchema: z.object({",
    "    title: z.string(),",
    "    content: z.string(),",
    "    wordCount: z.number(),",
    "  }),",
    "  handler: async ({ data }, ctx) => {",
    "    const draft = await ctx.ai.generate({",
    '      model: "openai/gpt-4o",',
    '      system: "You are a technical writer. Create engaging blog posts.",',
    '      prompt: "Write a blog post based on these findings:\\n" + data.findings.join("\\n"),',
    "    });",
    "",
    "    return {",
    "      title: data.summary.slice(0, 50),",
    "      content: draft,",
    "      wordCount: draft.split(/\\s+/).length,",
    "    };",
    "  },",
    "});",
  ].join("\n");

  // Step: publish to blog
  const publishStep = [
    'import { bindContract, z } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineStep } = bindContract(" + contractName + "Contract);",
    "",
    "/**",
    " * Publishes content to a blog platform.",
    " */",
    "export const publishToBlog = defineStep({",
    '  id: "publish_to_blog",',
    '  description: "Publish draft to blog platform",',
    "  inputSchema: z.object({",
    "    content: z.object({",
    "      title: z.string(),",
    "      content: z.string(),",
    "      wordCount: z.number(),",
    "    }),",
    "  }),",
    "  outputSchema: z.object({",
    "    url: z.string(),",
    "    publishedAt: z.string(),",
    "  }),",
    "  handler: async ({ content }, ctx) => {",
    "    // Publish to blog",
    '    ctx.log.info("Publishing: " + content.title);',
    "",
    "    return {",
    '      url: "https://blog.example.com/posts/" + Date.now(),',
    "      publishedAt: ctx.date.toISOString(),",
    "    };",
    "  },",
    "});",
  ].join("\n");

  // Route: health check
  const healthRoute = [
    'import { bindContract } from "@kalphq/sdk";',
    'import { ' + contractName + 'Contract } from "../contract/' + agentName + '-contract";',
    "",
    "const { defineRoute } = bindContract(" + contractName + "Contract);",
    "",
    "/**",
    " * Health check endpoint for the agent.",
    " */",
    "export const healthRoute = defineRoute({",
    '  id: "health",',
    '  method: "GET",',
    '  path: "/health",',
    "  handler: async ({ res, ctx }) => {",
    "    res.json({",
    '      status: "ok",',
    '      agent: "' + agentName + '",',
    "      timestamp: ctx.date.toISOString(),",
    "    });",
    "  },",
    "});",
  ].join("\n");

  // Hook: onInit
  const onInitHook = [
    'import { TypedKalpContext } from "@kalphq/sdk";',
    "import { " +
      contractName +
      'Contract } from "../contract/' +
      agentName +
      '-contract";',
    "",
    "/**",
    " * Runs when the agent starts up.",
    " * Initialize any required state here.",
    " */",
    "export async function onInit(ctx: TypedKalpContext<typeof " +
      contractName +
      "Contract>): Promise<void> {",
    "  // TODO: Load research cache, initialize connections, etc.",
    "}",
  ].join("\n");

  // Contract: research
  const contractFile = [
    'import { defineContract, z } from "@kalphq/sdk";',
    "",
    "/**",
    " * Contract for external systems to call the researcher agent.",
    " */",
    'export const ' + contractName + 'Contract = defineContract("' + agentName + '", {',
    "  input: z.object({",
    "    topic: z.string(),",
    '    depth: z.enum(["quick", "thorough"]).default("thorough"),',
    "  }),",
    "  output: z.object({",
    "    findings: z.array(z.string()),",
    "    publishedUrl: z.string().optional(),",
    "  }),",
    "});",
  ].join("\n");

  // Write all files
  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(
    join(agentDir, "steps"),
    "deep-research.ts",
    deepResearchStep,
  );
  await writeTemplateFile(
    join(agentDir, "steps"),
    "write-draft.ts",
    writeDraftStep,
  );
  await writeTemplateFile(
    join(agentDir, "steps"),
    "publish-to-blog.ts",
    publishStep,
  );
  await writeTemplateFile(join(agentDir, "routes"), "health.ts", healthRoute);
  await writeTemplateFile(join(agentDir, "hooks"), "onInit.ts", onInitHook);
  await writeTemplateFile(
    join(agentDir, "contract"),
    agentName + "-contract.ts",
    contractFile,
  );
}

/**
 * Researcher template definition.
 */
export const researcherTemplate: TemplateDefinition = {
  id: "researcher",
  name: "Researcher",
  description: "AI research assistant that schedules blog posts",
  icon: "🔬",
  generate: generateResearcher,
};
