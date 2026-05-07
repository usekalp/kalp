import { resolve, basename } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  scaffoldProject,
  scaffoldAgent,
  installDeps,
  ensureDirectory,
  type TemplateId,
} from "@kalphq/project";
import {
  isExistingKalpProject,
  isDirEmpty,
  validateProjectForAddAgent,
} from "@/utils";

/**
 * Prompt user to select an agent template.
 */
async function promptTemplateSelection(): Promise<TemplateId> {
  const answer = await p.select({
    message: "Choose an agent template:",
    options: [
      {
        value: "researcher",
        label: "🔬 Researcher",
        hint: "Deterministic scheduling - pause 24h and auto-resume",
      },
      {
        value: "support",
        label: "🎧 Support Agent",
        hint: "Human-in-the-Loop - pause for days until resolved",
      },
      {
        value: "blank",
        label: "⬜ Blank",
        hint: "Minimal structure with modern Kalp v1 syntax",
      },
    ],
  });

  if (p.isCancel(answer)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  return answer as TemplateId;
}

const LOGO = "🦋";

async function main(): Promise<void> {
  p.intro(`${LOGO} ${pc.bold("create-kalp")}`);

  // ── Project name ────────────────────────────────────────────────────────
  const projectInput = await p.text({
    message: "Project name?",
    placeholder: "my-app",
    validate: (v) => {
      const value = v.trim();
      if (!value) return "Project name is required.";
      if (value !== "." && !/^[a-z0-9-]+$/.test(value)) {
        return "Use lowercase letters, numbers, and dashes only (or . for current directory).";
      }
    },
  });

  if (p.isCancel(projectInput)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const isCurrentDir = projectInput.trim() === ".";
  const targetDir = isCurrentDir
    ? process.cwd()
    : resolve(process.cwd(), projectInput.trim());
  const projectName = isCurrentDir
    ? basename(process.cwd())
    : projectInput.trim();

  // ── Detect existing Kalp project ────────────────────────────────────────
  if (await isExistingKalpProject(targetDir)) {
    const action = await p.select({
      message: "Existing Kalp project detected. What do you want to do?",
      options: [
        { value: "cancel", label: "Cancel" },
        { value: "overwrite", label: "Overwrite" },
        { value: "add-agent", label: "Add agent only" },
      ],
    });

    if (p.isCancel(action) || action === "cancel") {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    if (action === "add-agent") {
      // Validate project structure before scaffolding
      const validation = await validateProjectForAddAgent(targetDir);
      if (!validation.valid) {
        p.log.error(
          `Invalid Kalp project — missing required items:\n` +
            validation.missing.map((m) => `  • ${m}`).join("\n"),
        );
        p.outro(
          pc.dim("Run create-kalp in an empty directory for a fresh project."),
        );
        process.exit(1);
      }

      const agentName = await p.text({
        message: "Agent name?",
        placeholder: "my-agent",
        validate: (v) => {
          if (!v.trim()) return "Agent name is required.";
          if (!/^[a-z0-9-]+$/.test(v)) {
            return "Use lowercase letters, numbers, and dashes only.";
          }
        },
      });

      if (p.isCancel(agentName)) {
        p.cancel("Cancelled.");
        process.exit(0);
      }

      // ── Template selection ───────────────────────────────────────────────
      const template = await promptTemplateSelection();

      const s = p.spinner();
      s.start(`Scaffolding agent ${pc.cyan(agentName.trim())}`);
      await scaffoldAgent({
        agentName: agentName.trim(),
        cwd: targetDir,
        template,
      });
      s.stop(`Agent created (${template} template)`);

      p.outro(
        `${LOGO} ${pc.green(`Agent ${pc.bold(agentName.trim())} is ready.`)}`,
      );
      return;
    }

    // overwrite → fall through to full scaffold
  } else if (!(await isDirEmpty(targetDir))) {
    // ── Non-empty, non-Kalp directory ───────────────────────────────────
    const confirm = await p.confirm({
      message: "Directory is not empty. Continue?",
      initialValue: false,
    });

    if (p.isCancel(confirm) || !confirm) {
      p.cancel("Cancelled.");
      process.exit(0);
    }
  }

  // ── Agent name ──────────────────────────────────────────────────────────
  const agentName = await p.text({
    message: "First agent name?",
    placeholder: "my-agent",
    validate: (v) => {
      if (!v.trim()) return "Agent name is required.";
      if (!/^[a-z0-9-]+$/.test(v)) {
        return "Use lowercase letters, numbers, and dashes only.";
      }
    },
  });

  if (p.isCancel(agentName)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  // ── Template selection ───────────────────────────────────────────────────
  const template = await promptTemplateSelection();

  const s = p.spinner();

  // ── Create target directory if needed ──────────────────────────────────
  if (!isCurrentDir) {
    await ensureDirectory(targetDir);
  }

  // ── Scaffold project ──────────────────────────────────────────────────
  s.start("Creating project structure");
  await scaffoldProject({ projectName, targetDir });
  s.stop("Project structure created");

  // ── Scaffold agent ────────────────────────────────────────────────────
  s.start(`Scaffolding agent ${pc.cyan(agentName.trim())}`);
  await scaffoldAgent({
    agentName: agentName.trim(),
    cwd: targetDir,
    template,
  });
  s.stop(`Agent created (${template} template)`);

  // ── Install deps ──────────────────────────────────────────────────────
  s.start("Installing dependencies");
  try {
    await installDeps(targetDir);
    s.stop("Dependencies installed");
  } catch {
    s.stop(pc.yellow("Install failed — run npm install manually."));
  }

  // ── Next steps ────────────────────────────────────────────────────────
  console.log("");
  p.log.info(pc.bold("Next steps"));
  if (!isCurrentDir) {
    console.log(`  ${pc.cyan(`cd ${projectName}`)}`);
  }
  console.log(`  ${pc.cyan("kalp create")}    ${pc.dim("← add more agents")}`);
  console.log(
    `  ${pc.cyan("kalp dev")}       ${pc.dim("← start development")}`,
  );

  p.outro(`${LOGO} ${pc.green("Happy building!")}`);
}

main().catch((err) => {
  p.log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
