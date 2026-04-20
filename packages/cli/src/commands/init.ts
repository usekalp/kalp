import { resolve, basename } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { scaffoldProject } from "../scaffold.js";
import { promptProjectName } from "../utils/ui.js";
import {
  ensureDirectory,
  installDeps,
  isProjectInitialized,
} from "../utils/fs.js";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "init", description: "Scaffold a new Kalp project" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp init")}`);

    const projectInputName = await promptProjectName({
      message: "What is the name of your project?",
      placeholder: "my-agent",
      allowCurrentDir: true,
    });

    const isCurrentDir = projectInputName === ".";
    const targetDir = isCurrentDir ? cwd : resolve(cwd, projectInputName);
    const projectName = isCurrentDir ? basename(cwd) : projectInputName;

    // ── Guard: already initialized ───────────────────────────────────────
    if (await isProjectInitialized(targetDir)) {
      p.log.error(
        `${pc.cyan("kalp.config.ts")} already exists in this directory. Run ${pc.cyan("kalp create")} to add an agent.`,
      );
      process.exit(1);
    }

    // ── Create target directory if needed ─────────────────────────────────
    if (!isCurrentDir) {
      await ensureDirectory(targetDir);
    }

    const s = p.spinner();

    s.start("Creating project structure");
    await scaffoldProject({ projectName, targetDir });
    s.stop("Project structure created");

    s.start("Installing Dependencies");
    try {
      await installDeps(targetDir);
      s.stop("Dependencies installed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      s.stop(pc.yellow("Install failed"));
      p.log.warn(
        `Run ${pc.cyan("npx --no-install nci")} (or ${pc.cyan("npm install")}) manually in ${isCurrentDir ? "this directory" : projectInputName + "/"}`,
      );
      p.log.info(pc.dim(msg.split("\n")[0] ?? "Unknown error"));
    }

    p.log.success("Project scaffolded");
    p.log.info(`${pc.cyan("agents/")} — your agents live here`);
    console.log("");
    p.log.info(pc.bold("Next"));
    if (!isCurrentDir) {
      p.log.info(`1. ${pc.cyan(`cd ${projectInputName}`)}`);
      p.log.info(`2. ${pc.cyan("kalp create")} — add your first agent`);
    } else {
      p.log.info(`1. ${pc.cyan("kalp create")} — add your first agent`);
    }

    p.outro(pc.green("Kalp initialized successfully."));
  },
});
