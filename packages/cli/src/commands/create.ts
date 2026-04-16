import { join } from "node:path";
import { access } from "node:fs/promises";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { installDependencies, detectPackageManager } from "nypm";
import { scaffoldProject, scaffoldAgent } from "../scaffold.js";
import { TEMPLATES, type TemplateId } from "../templates/index.js";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "create", description: "Add a new agent to the project" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp create")}`);

    // ── Check if project is initialized ─────────────────────────────────
    let needsInit = false;
    try {
      await access(join(cwd, "kalp.config.ts"));
    } catch {
      needsInit = true;
    }

    // ── Init phase (inline — one unified timeline) ───────────────────────
    let projectName: string | undefined;
    if (needsInit) {
      p.log.warn(
        `No ${pc.cyan("kalp.config.ts")} found — initializing project first.`,
      );

      const initAnswers = await p.group(
        {
          name: () =>
            p.text({
              message: "Project name?",
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
            p.cancel("Cancelled.");
            process.exit(0);
          },
        },
      );

      projectName = initAnswers.name;
    }

    // ── Agent prompts ────────────────────────────────────────────────────
    const agentAnswers = await p.group(
      {
        name: () =>
          p.text({
            message: "Agent name?",
            placeholder: "my-agent",
            validate: (v) => {
              if (!v.trim()) return "Agent name is required.";
              if (!/^[a-z0-9-]+$/.test(v))
                return "Use lowercase letters, numbers, and dashes only.";
            },
          }),
        template: () =>
          p.select<TemplateId>({
            message: "Choose a template",
            options: TEMPLATES.map((t) => ({
              value: t.id,
              label: t.label,
              hint: pc.dim(t.hint),
            })),
          }),
      },
      {
        onCancel: () => {
          p.cancel("Cancelled.");
          process.exit(0);
        },
      },
    );

    const s = p.spinner();

    // ── Scaffold project if needed ───────────────────────────────────────
    if (needsInit && projectName) {
      s.start("Creating project structure");
      await scaffoldProject({ projectName, cwd });
      s.stop("Project structure created");

      const pm = await detectPackageManager(cwd);
      const pmName = pm?.name ?? "npm";
      s.start(`Installing dependencies ${pc.dim(`(${pmName} install)`)}`);
      try {
        await installDependencies({ cwd: join(cwd, "kalp"), silent: true });
        s.stop("Dependencies installed");
      } catch {
        s.stop(pc.yellow("Install skipped — run manually inside kalp/"));
      }
    }

    // ── Scaffold agent ───────────────────────────────────────────────────
    s.start(`Scaffolding agent ${pc.cyan(agentAnswers.name)}`);
    await scaffoldAgent({
      agentName: agentAnswers.name,
      templateId: agentAnswers.template as TemplateId,
      cwd,
    });
    s.stop("Agent created");

    p.note(
      [
        `${pc.dim("•")} ${pc.cyan(`kalp/agents/${agentAnswers.name}/index.ts`)}`,
        `${pc.dim("•")} ${pc.cyan(`kalp/agents/${agentAnswers.name}/steps/`)}`,
        `${pc.dim("•")} ${pc.cyan(`kalp/agents/${agentAnswers.name}/tools/`)}`,
      ].join("\n"),
      "Created",
    );

    p.outro(
      `${LOGO} ${pc.green(`Agent ${pc.bold(agentAnswers.name)} is ready.`)}`,
    );
  },
});
