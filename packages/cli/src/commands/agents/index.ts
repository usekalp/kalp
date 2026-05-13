import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "agents",
    description: "Inspect and manage project agents",
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
    list: () => import("./list").then((r) => r.default),
    delete: () => import("./delete").then((r) => r.default),
  },
  run({ args }) {
    p.intro(`${LOGO} ${pc.bold("kalp agents")}`);
    p.log.message(pc.bold("Available subcommands:"));
    p.log.message(`  ${pc.cyan("list")}    Compare local and remote agent status`);
    p.log.message(`  ${pc.cyan("delete")}  Delete an agent from remote runtime`);
    p.log.message("");
    p.log.message(
      `Run ${pc.cyan("kalp agents <subcommand> --help")} for more info.`,
    );
    p.outro(args.help ? pc.dim("Done") : pc.dim("Select a subcommand above."));
  },
});
