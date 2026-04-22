import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { scaffoldAgent } from "@kalphq/project";
import { isProjectInitialized } from "@/utils/fs";
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
    const agentAnswers = await promptAgentDetails();

    const s = p.spinner();

    // ── Scaffold agent ───────────────────────────────────────────────────
    s.start(`Scaffolding agent ${pc.cyan(agentAnswers.name)}`);
    await scaffoldAgent({
      agentName: agentAnswers.name,
      cwd,
    });
    s.stop("Agent created");

    p.note(
      [
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/index.ts`)}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/steps/`)}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/tools/`)}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/routes/`)}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/flows/`)}`,
      ].join("\n"),
      "Created",
    );

    p.outro(
      `${LOGO} ${pc.green(`Agent ${pc.bold(agentAnswers.name)} is ready.`)}`,
    );
  },
});
