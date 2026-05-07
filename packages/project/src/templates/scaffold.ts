/**
 * Agent scaffolding with template support.
 *
 * @module
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateId } from "./types";
import { getTemplate } from "./index";

export interface ScaffoldAgentOptions {
  agentName: string;
  cwd: string;
  template?: TemplateId;
}

/**
 * Scaffolds a new agent with optional template.
 *
 * If a template is specified, uses the template's generate function.
 * Otherwise creates a minimal default agent.
 */
export async function scaffoldAgent(opts: ScaffoldAgentOptions): Promise<void> {
  const { agentName, cwd, template } = opts;

  // If template specified, use template generator
  if (template) {
    const templateDef = getTemplate(template);
    if (!templateDef) {
      throw new Error(`Unknown template: ${template}`);
    }
    await templateDef.generate({ agentName, cwd });
    return;
  }

  // Default minimal scaffold
  const agentDir = join(cwd, "agents", agentName);

  await mkdir(join(agentDir, "steps"), { recursive: true });
  await mkdir(join(agentDir, "tools"), { recursive: true });
  await mkdir(join(agentDir, "routes"), { recursive: true });
  await mkdir(join(agentDir, "hooks"), { recursive: true });
  await mkdir(join(agentDir, "contract"), { recursive: true });

  const agentIndex = `import { defineAgent } from "@kalphq/sdk";

export default defineAgent({
  name: "${agentName}",
  description: "A helpful AI assistant",

  async onMessage(ctx) {
    return { text: "" };
  },
});
`;

  await writeFile(join(agentDir, "index.ts"), agentIndex, "utf-8");
}
