import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "secrets",
    description: "Manage Kalp Cloud secrets",
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
    list: () => import("./list.js").then((r) => r.default),
    add: () => import("./add.js").then((r) => r.default),
    delete: () => import("./delete.js").then((r) => r.default),
  },
  run({ args }) {
    if (!args.help) {
      return;
    }

    p.intro(`${LOGO} ${pc.bold("kalp secrets")}`);
    p.log.message(pc.bold("Available subcommands:"));
    p.log.message(`  ${pc.cyan("list")}   List secrets from Kalp Cloud`);
    p.log.message(`  ${pc.cyan("add")}    Add a secret to Kalp Cloud`);
    p.log.message(`  ${pc.cyan("delete")} Delete a secret from Kalp Cloud`);
    p.log.message("");
    p.log.message(
      `Run ${pc.cyan("kalp secrets <subcommand> --help")} for more info.`,
    );
    p.outro(pc.dim("Done"));
  },
});
