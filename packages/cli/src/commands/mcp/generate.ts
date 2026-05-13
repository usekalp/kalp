import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { cwd } from "node:process";
import { generateMcpTypes } from "@/utils/mcp-codegen";
import { generateTypes } from "@/utils/codegen";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "generate",
    description: "Generate MCP tool types into .kalp/mcp.types.d.ts",
  },
  args: {
    strict: {
      type: "boolean",
      description: "Fail when at least one MCP server cannot be introspected",
      default: false,
    },
  },
  async run({ args }) {
    p.intro(`${LOGO} ${pc.bold("kalp mcp generate")}`);
    const spinner = p.spinner();
    spinner.start("Discovering MCP servers and generating types");

    try {
      const projectCwd = cwd();
      await generateTypes(projectCwd);
      const result = await generateMcpTypes(projectCwd, {
        strict: args.strict,
      });

      spinner.stop("MCP type generation completed");

      if (result.servers.length === 0) {
        p.log.warn(
          "No MCP servers found in kalp.config.ts. Generated an empty McpRegistry.",
        );
      } else {
        for (const server of result.servers) {
          p.log.info(
            `${pc.bold(server.serverName)} (${server.transport}) -> ${server.tools.length} tools`,
          );
        }
      }

      if (result.warnings.length > 0) {
        p.log.warn(pc.bold("Warnings:"));
        for (const warning of result.warnings) {
          p.log.warn(`- ${warning}`);
        }
      }

      p.outro(`Types written to ${pc.cyan(result.outputPath)}`);
    } catch (error) {
      spinner.stop("MCP type generation failed");
      const message = error instanceof Error ? error.message : String(error);
      p.cancel(message);
      process.exitCode = 1;
    }
  },
});
