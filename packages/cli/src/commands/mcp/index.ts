import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "mcp",
    description: "Generate and manage MCP tool typing",
  },
  args: {
    help: {
      type: "boolean",
      alias: "h",
      description: "Show help",
      default: false,
    },
  },
  subCommands: {
    generate: () => import("./generate").then((r) => r.default),
  },
  run({ args }) {
    const subcommand = process.argv[3];
    if (subcommand && subcommand !== "--help" && subcommand !== "-h") {
      return;
    }

    p.intro(`${LOGO} ${pc.bold("kalp mcp")}`);
    p.log.message(pc.bold("Available subcommands:"));
    p.log.message(`  ${pc.cyan("generate")}  Generate MCP types from kalp.config.ts`);
    p.log.message("");
    p.log.message(`Run ${pc.cyan("kalp mcp <subcommand> --help")} for more info.`);
  },
});
