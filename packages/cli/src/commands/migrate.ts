import { access } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureConfig } from "../utils/fs.js";
import {
  readAgentManifest,
  writeVersionedManifest,
} from "../utils/manifest.js";

const LOGO = "🦋";

export default defineCommand({
  meta: {
    name: "migrate",
    description: "Migrate Agent schema to new version",
  },
  args: {
    agent: {
      type: "string",
      alias: "a",
      description: "Agent name",
      required: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp migrate")}`);

    const agentName = args.agent;
    if (!agentName) {
      p.log.error(`Missing required flag ${pc.cyan("-a <agent-name>")}`);
      p.outro(pc.dim(`Example: ${pc.cyan("kalp migrate -a my-agent")}`));
      process.exit(1);
    }

    try {
      await ensureConfig(cwd);
    } catch {
      p.log.error(`${pc.cyan("kalp.config.ts")} not found`);
      p.outro(pc.dim(`Run ${pc.cyan("kalp init")} first.`));
      process.exit(1);
    }

    const agentPath = join(cwd, "agents", agentName, "index.ts");
    try {
      await access(agentPath);
    } catch {
      p.log.error(
        `Agent ${pc.cyan(agentName)} not found at ${pc.cyan(`agents/${agentName}/index.ts`)}`,
      );
      process.exit(1);
    }

    const s = p.spinner();
    s.start(`Migrating ${pc.cyan(agentName)}`);

    try {
      const manifest = await readAgentManifest({ cwd, agentName });
      const version = await writeVersionedManifest({
        cwd,
        agentName,
        manifest,
      });

      s.stop(`Migration ${pc.cyan(version.versionId)} generated`);
      p.outro(
        `${LOGO} ${pc.green("Migration ready")} ${pc.dim("— run kalp push -a <agent>")}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      s.stop(pc.red("Migration failed"));
      p.log.info(pc.dim(msg.split("\n")[0] ?? "Unknown error"));
      process.exit(1);
    }
  },
});
