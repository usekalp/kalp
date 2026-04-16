import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { scaffoldProject, scaffoldAgent } from "../scaffold.js";
import { installDeps, isProjectInitialized } from "../utils/fs.js";
import { promptAgentDetails, promptProjectName } from "../utils/ui.js";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "create", description: "Add a new agent to the project" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp create")}`);

    // ── Check if project is initialized ─────────────────────────────────
    const needsInit = !(await isProjectInitialized(cwd));

    // ── Init phase (inline — one unified timeline) ───────────────────────
    let projectName: string | undefined;
    if (needsInit) {
      p.log.warn(
        `No ${pc.cyan("kalp.config.ts")} found — initializing project first.`,
      );
      projectName = await promptProjectName({
        message: "Project name?",
        placeholder: "my-project",
      });
    }

    // ── Agent prompts ────────────────────────────────────────────────────
    const agentAnswers = await promptAgentDetails();

    const s = p.spinner();

    // ── Scaffold project if needed ───────────────────────────────────────
    if (needsInit && projectName) {
      s.start("Creating project structure");
      await scaffoldProject({ projectName, targetDir: cwd });
      s.stop("Project structure created");

      s.start("Installing dependencies");
      try {
        await installDeps(cwd);
        s.stop("Dependencies installed");
      } catch {
        s.stop(
          pc.yellow(
            "Install failed — run npx --no-install nci (or npm install) manually.",
          ),
        );
      }
    }

    // ── Scaffold agent ───────────────────────────────────────────────────
    s.start(`Scaffolding agent ${pc.cyan(agentAnswers.name)}`);
    await scaffoldAgent({
      agentName: agentAnswers.name,
      templateId: agentAnswers.templateId,
      cwd,
    });
    s.stop("Agent created");

    p.note(
      [
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/index.ts`)}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/steps/`)}`,
        `${pc.dim("•")} ${pc.cyan(`agents/${agentAnswers.name}/tools/`)}`,
      ].join("\n"),
      "Created",
    );

    p.outro(
      `${LOGO} ${pc.green(`Agent ${pc.bold(agentAnswers.name)} is ready.`)}`,
    );
  },
});
