import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { requireAuth } from "@/utils/auth";
import { runInitialDeploy } from "@/utils/deploy";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "deploy", description: "Deploy Worker + Studio to Cloudflare" },
  async run() {
    const cwd = process.cwd();

    p.intro(`${LOGO} ${pc.bold("kalp deploy")}`);

    await requireAuth().catch(() => {
      p.log.error("Not authenticated. Run `kalp login` first.");
      process.exit(1);
    });

    const target = await p.select({
      message: "Choose deployment target",
      options: [
        { label: "Cloudflare (Recommended)", value: "cloudflare" },
        { label: "Kalp Cloud (Coming soon)", value: "kalp-cloud" },
      ],
    });

    if (p.isCancel(target)) {
      p.outro("Cancelled");
      return;
    }

    if (target === "kalp-cloud") {
      p.note(
        "Coming soon. Enterprise cloud execution is currently waitlisted.",
        "Kalp Cloud",
      );
      p.outro(pc.dim("No deployment executed."));
      return;
    }

    const s = p.spinner();
    s.start("Deploying to Cloudflare");

    try {
      const result = await runInitialDeploy(cwd);
      s.stop("Deployment completed");
      p.log.success(`Worker URL: ${pc.cyan(result.workerUrl)}`);
      p.outro(pc.green("Cloudflare deployment ready"));
    } catch (error) {
      s.stop("Deployment failed");
      p.log.error(
        error instanceof Error ? error.message : "Unknown deployment error",
      );
      process.exit(1);
    }
  },
});
