import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { scaffoldAgent } from "@kalphq/project";
import { isProjectInitialized } from "@/utils/fs";
import { generateTypes } from "@/utils/codegen";
import { promptAgentDetails } from "@/utils/ui";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "create", description: "Add a new agent to the project" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp create")}`);

    // ── Check if project is initialized ─────────────────────────────────
    const needsInit = !(await isProjectInitialized(cwd));

    if (needsInit) {
      p.log.error("This is not a Kalp project.");
      console.log("");
      console.log("  Run:");
      console.log(`    ${pc.cyan("npx create-kalp@latest")}`);
      console.log("");
      process.exit(1);
    }

    // ── Agent prompts ────────────────────────────────────────────────────
    const agentAnswers = await promptAgentDetails({ includeTemplate: true });

    // ── Check if agent already exists ────────────────────────────────────
    const agentDir = join(cwd, "agents", agentAnswers.name);
    if (existsSync(agentDir)) {
      p.log.error(`Agent "${agentAnswers.name}" already exists.`);
      console.log("");
      console.log(`  ${pc.dim("Location:")} ${pc.cyan(agentDir)}`);
      console.log("");
      console.log(
        `  ${pc.dim("Choose a different name or remove the existing agent.")}`,
      );
      process.exit(1);
    }

    const s = p.spinner();

    // ── Scaffold agent ───────────────────────────────────────────────────
    s.start(`Scaffolding agent ${pc.cyan(agentAnswers.name)}`);
    await scaffoldAgent({
      agentName: agentAnswers.name,
      label: agentAnswers.label,
      cwd,
      template: agentAnswers.template,
    });
    await generateTypes(cwd);
    s.stop(
      agentAnswers.template
        ? `Agent created (${agentAnswers.template} template)`
        : "Agent created",
    );

    p.note(
      [
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/index.ts`)} ${pc.dim("— Agent entrypoint with config")}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/contract/`)} ${pc.dim("— RPC contract definition")}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/hooks/`)} ${pc.dim("— Lifecycle hooks (onInit, onTick)")}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/routes/`)} ${pc.dim("— HTTP endpoints")}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/steps/`)} ${pc.dim("— Reusable workflow steps")}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/tools/`)} ${pc.dim("— Callable agent tools")}`,
      ].join("\n"),
      "Created",
    );

    p.outro(
      `${LOGO} ${pc.green(`Agent ${pc.bold(agentAnswers.name)} is ready.`)}`,
    );
  },
});
