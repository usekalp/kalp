import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { cwd } from "node:process";
import { synchronizer } from "@/utils/sync";
import { ProjectTypesGenerator } from "@/utils/codegen";
import { McpTypesGenerator } from "@/utils/mcp-codegen";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "generate",
    description: "Synchronize project types, MCP tools, and manifests",
  },
  args: {
    force: {
      type: "boolean",
      description: "Force regeneration of all artifacts",
      default: false,
    },
    mcpOnly: {
      type: "boolean",
      description: "Only regenerate MCP types",
      default: false,
    },
  },
  async run({ args }) {
    p.intro(`${LOGO} ${pc.bold("kalp generate")}`);
    const projectCwd = cwd();

    // 1. Register generators (Decoupled bootstrap)
    synchronizer
      .register(new ProjectTypesGenerator())
      .register(new McpTypesGenerator());

    const spinner = p.spinner();
    spinner.start("Synchronizing project artifacts");

    try {
      const ids = args.mcpOnly ? ["mcp"] : undefined;
      const results = await synchronizer.run(projectCwd, { ids, force: args.force });

      spinner.stop("Synchronization completed");

      // 2. Report results
      for (const [id, result] of Object.entries(results)) {
        const icon = result.updated ? pc.green("✓") : pc.dim("-");
        const status = result.updated ? "updated" : "up to date";
        p.log.info(`${icon} ${pc.bold(id)}: ${status}`);
        
        if (result.warnings?.length) {
          for (const warning of result.warnings) {
            p.log.warn(`  ${pc.yellow("▲")} ${pc.dim(warning)}`);
          }
        }
      }

      // 3. Ensure tsconfig is updated
      await ensureTsconfigIncludes(projectCwd);

      p.outro(pc.green("Project is in sync!"));
    } catch (error) {
      spinner.stop("Synchronization failed");
      const message = error instanceof Error ? error.message : String(error);
      p.cancel(message);
      process.exit(1);
    }
  },
});

async function ensureTsconfigIncludes(cwd: string) {
  const tsconfigPath = join(cwd, "tsconfig.json");
  try {
    const content = await readFile(tsconfigPath, "utf-8");
    const json = JSON.parse(content);
    if (!json.include) json.include = [];
    
    const required = [".kalp/generated/*.d.ts"];
    let changed = false;
    
    for (const path of required) {
      if (!json.include.includes(path)) {
        json.include.push(path);
        changed = true;
      }
    }
    
    if (changed) {
      await writeFile(tsconfigPath, JSON.stringify(json, null, 2), "utf-8");
      p.log.info(`${pc.blue("ℹ")} Updated tsconfig.json to include .kalp/generated/*.d.ts`);
    }
  } catch {
    // Ignore if no tsconfig
  }
}
