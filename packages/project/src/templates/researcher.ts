/**
 * Researcher template - demonstrates deterministic time scheduling and MCP.
 *
 * Shows how an agent can pause execution for 24 hours and resume to publish results.
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
}): Promise<void> {
  const { agentName, cwd } = opts;
  const agentDir = join(cwd, "agents", agentName);

  // Main agent file with waitUntil magic
  const agentIndex = [
    'import { defineAgent } from "@kalphq/sdk";',
    'import { deepResearch } from "./steps/deep-research";',
    'import { writeDraft } from "./steps/write-draft";',
    'import { publishToBlog } from "./steps/publish-to-blog";',
    'import { healthRoute } from "./routes/health";',
    '',
    '/**',
    ' * Researcher agent demonstrating deterministic time scheduling.',
    ' *',
    ' * This agent pauses execution for 24 hours using waitUntil() and',
    ' * automatically resumes to publish results. The server can shut',
    ' * down during the pause - state is preserved in the event log.',
    ' *',
    ' * Uncomment mcp: [] to enable Model Context Protocol servers.',
    ' */',
    'export default defineAgent({',
    '  name: "' + agentName + '",',
    '  description: "AI research assistant with scheduled publishing",',
    '',
    '  // MCP servers from kalp.config.ts - uncomment to enable:',
    '  // mcp: ["brave_search", "github"],',
    '',
    '  routes: [healthRoute],',
    '',
    '  async onMessage(ctx) {',
    '    // 1. Deep research using steps',
    '    const researchData = await ctx.actions.run(deepResearch, {',
    '      topic: ctx.message.text,',
    '    });',
    '',
    '    // 2. Write the draft',
    '    const draft = await ctx.actions.run(writeDraft, { data: researchData });',
    '',
    '    // 3. Use deterministic date primitive for scheduling',
    '    // ctx.date.now() returns the original event timestamp (deterministic)',
    '    const publishTime = ctx.date.add("24h"); // 24 hours from event timestamp',
    '',
    '    // 4. THE MAGIC: Pause agent until tomorrow',
    '    // Server shuts down, but state (draft, researchData) is preserved',
    '    // Agent will automatically resume at publishTime',
    '    await ctx.actions.waitUntil(publishTime);',
    '',
    '    // 5. Agent revives automatically and publishes',
    '    await ctx.actions.run(publishToBlog, { content: draft });',
    '',
    '    return {',
    '      text: "Research complete! Publication scheduled for " + ctx.date.timezone("UTC").format("YYYY-MM-DD HH:mm"),',
    '    };',
    '  },',
    '});',
  ].join("\n");

  // Deep research step
  const deepResearchStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Performs deep research on a given topic.',
    ' */',
    'export const deepResearch = defineStep({',
    '  name: "deep_research",',
    '  description: "Research a topic thoroughly",',
    '  input: z.object({ topic: z.string() }),',
    '  output: z.object({',
    '    findings: z.array(z.string()),',
    '    sources: z.array(z.string()),',
    '    summary: z.string(),',
    '  }),',
    '  async handler(ctx, { topic }) {',
    '    // Use AI to research the topic',
    '    const result = await ctx.ai.generate({',
    '      model: "openai/gpt-4o-mini",',
    '      system: "You are a research assistant. Provide detailed findings with sources.",',
    '      prompt: "Research this topic thoroughly: " + topic,',
    '    });',
    '',
    '    // Parse and structure the results',
    '    return {',
    '      findings: result.text.split("\\n").filter((line) => line.trim()),',
    '      sources: ["https://example.com/source1", "https://example.com/source2"],',
    '      summary: result.text.slice(0, 200) + "...",',
    '    };',
    '  },',
    '});',
  ].join("\n");

  // Write draft step
  const writeDraftStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Writes a polished draft from research data.',
    ' */',
    'export const writeDraft = defineStep({',
    '  name: "write_draft",',
    '  description: "Write a blog post draft from research",',
    '  input: z.object({',
    '    data: z.object({',
    '      findings: z.array(z.string()),',
    '      sources: z.array(z.string()),',
    '      summary: z.string(),',
    '    }),',
    '  }),',
    '  output: z.object({',
    '    title: z.string(),',
    '    content: z.string(),',
    '    wordCount: z.number(),',
    '  }),',
    '  async handler(ctx, { data }) {',
    '    const draft = await ctx.ai.generate({',
    '      model: "openai/gpt-4o",',
    '      system: "You are a technical writer. Create engaging blog posts.",',
    '      prompt: "Write a blog post based on these findings:\\n" + data.findings.join("\\n"),',
    '    });',
    '',
    '    return {',
    '      title: data.summary.slice(0, 50),',
    '      content: draft.text,',
    '      wordCount: draft.text.split(/\\s+/).length,',
    '    };',
    '  },',
    '});',
  ].join("\n");

  // Publish to blog step
  const publishStep = [
    'import { defineStep, z } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Publishes content to a blog platform.',
    ' */',
    'export const publishToBlog = defineStep({',
    '  name: "publish_to_blog",',
    '  description: "Publish draft to blog platform",',
    '  input: z.object({',
    '    content: z.object({',
    '      title: z.string(),',
    '      content: z.string(),',
    '      wordCount: z.number(),',
    '    }),',
    '  }),',
    '  output: z.object({',
    '    url: z.string(),',
    '    publishedAt: z.string(),',
    '  }),',
    '  async handler(ctx, { content }) {',
    '    // Simulated blog publication',
    '    // In production, this would call your blog API',
    '    ctx.log.info("Publishing: " + content.title);',
    '',
    '    return {',
    '      url: "https://blog.example.com/posts/" + Date.now(),',
    '      publishedAt: ctx.date.toISOString(),',
    '    };',
    '  },',
    '});',
  ].join("\n");

  // Health route
  const healthRoute = [
    'import { defineRoute } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Health check endpoint for the agent.',
    ' */',
    'export const healthRoute = defineRoute({',
    '  name: "health",',
    '  method: "GET",',
    '  path: "/health",',
    '  handler: async (req, res) => {',
    '    res.json({',
    '      status: "ok",',
    '      agent: "' + agentName + '",',
    '      timestamp: new Date().toISOString(),',
    '    });',
    '  },',
    '});',
  ].join("\n");

  // Hooks
  const onInitHook = [
    '/**',
    ' * Runs when the agent starts up.',
    ' * Initialize any required state here.',
    ' */',
    'export async function onInit(): Promise<void> {',
    '  // TODO: Load research cache, initialize connections, etc.',
    '}',
  ].join("\n");

  // Contract
  const contractFile = [
    'import { defineContract, z } from "@kalphq/sdk";',
    '',
    '/**',
    ' * Contract for external systems to call the researcher agent.',
    ' */',
    'export const researchContract = defineContract({',
    '  name: "research",',
    '  input: z.object({',
    '    topic: z.string(),',
    '    depth: z.enum(["quick", "thorough"]).default("thorough"),',
    '  }),',
    '  output: z.object({',
    '    findings: z.array(z.string()),',
    '    publishedUrl: z.string().optional(),',
    '  }),',
    '});',
  ].join("\n");

  // Write all files
  await writeTemplateFile(agentDir, "index.ts", agentIndex);
  await writeTemplateFile(join(agentDir, "steps"), "deep-research.ts", deepResearchStep);
  await writeTemplateFile(join(agentDir, "steps"), "write-draft.ts", writeDraftStep);
  await writeTemplateFile(join(agentDir, "steps"), "publish-to-blog.ts", publishStep);
  await writeTemplateFile(join(agentDir, "routes"), "health.ts", healthRoute);
  await writeTemplateFile(join(agentDir, "hooks"), "onInit.ts", onInitHook);
  await writeTemplateFile(join(agentDir, "contract"), "research-contract.ts", contractFile);
}

/**
 * Researcher template definition.
 */
export const researcherTemplate: TemplateDefinition = {
  id: "researcher",
  name: "Researcher",
  description: "Deterministic time scheduling with waitUntil - pause for 24h and auto-resume",
  icon: "🔬",
  generate: generateResearcher,
};
