import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { requireAuth } from "@/utils/auth";
import { runInitialDeploy } from "@/utils/deploy";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "deploy", description: "Deploy your agents runtime" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp deploy")}`);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    const proceed = await p.confirm({
      message: "Deploy your runtime now?",
      initialValue: true,
    });
    if (p.isCancel(proceed) || !proceed) {
      p.outro("Cancelled");
      return;
    }

    const s = p.spinner();
    s.start("Deploying your agents runtime");

    try {
      const result = await runInitialDeploy(cwd);
      s.stop("Deployment completed");
      p.log.success(`Runtime URL: ${pc.cyan(result.workerUrl)}`);
      p.outro(pc.green("Your runtime is ready"));
    } catch (error) {
      s.stop("Deployment failed");
      p.log.error(
        error instanceof Error ? error.message : "Unknown deployment error",
      );
      process.exit(1);
    }
  },
});
