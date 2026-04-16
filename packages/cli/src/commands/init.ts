import { join } from "node:path";
import { access } from "node:fs/promises";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { scaffoldProject } from "../scaffold.js";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "init", description: "Scaffold a new Kalp project" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp init")}`);

    // ── Guard: already initialized ───────────────────────────────────────
    try {
      await access(join(cwd, "kalp.config.ts"));
      p.log.error(
        `${pc.cyan("kalp.config.ts")} already exists. Run ${pc.cyan("kalp create")} to add an agent.`,
      );
      process.exit(1);
    } catch {
      // expected: file doesn't exist yet
    }

    const answers = await p.group(
      {
        name: () =>
          p.text({
            message: "What is the name of your project?",
            placeholder: "my-project",
            validate: (v) => {
              if (!v.trim()) return "Project name is required.";
              if (!/^[a-z0-9-]+$/.test(v))
                return "Use lowercase letters, numbers, and dashes only.";
            },
          }),
      },
      {
        onCancel: () => {
          p.cancel("Setup cancelled.");
          process.exit(0);
        },
      },
    );

    const s = p.spinner();
    s.start("Creating project structure");
    await scaffoldProject({ projectName: answers.name, cwd });
    s.stop("Project structure created");

    p.note(
      [
        `${pc.dim("•")} ${pc.cyan("kalp.config.ts")} ${pc.dim("— project config")}`,
        `${pc.dim("•")} ${pc.cyan("kalp/")} ${pc.dim("— agents sub-package")}`,
        ``,
        `${pc.dim("Next steps:")}`,
        `  ${pc.cyan("cd kalp && npm install")}`,
        `  ${pc.cyan("kalp create")} ${pc.dim("— add your first agent")}`,
      ].join("\n"),
      "Created",
    );

    p.outro(`${LOGO} ${pc.green("Project initialized.")}`);
  },
});
