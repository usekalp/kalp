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
      if (result.customDomains.length > 0) {
        p.note(
          result.customDomains.map((domain) => pc.cyan(`https://${domain}`)).join("\n"),
          "Custom domains detected",
        );
      }

      const preferredStudioBase =
        result.customDomains.length > 0
          ? `https://${result.customDomains[0]}`
          : result.workerUrl;

      if (result.credentialsChanged) {
        p.note(
          [
            `${pc.bold("Studio credentials")}`,
            `${pc.dim("Username:")} ${pc.cyan(result.studioAdminUser)}`,
            `${pc.dim("Password:")} ${pc.cyan(result.studioPassword)}`,
            `${pc.dim("Studio:")} ${pc.cyan(`${preferredStudioBase.replace(/\/$/, "")}/studio/login`)}`,
          ].join("\n"),
          "Admin access",
        );
      } else {
        p.log.info(
          pc.dim(
            "Studio credentials unchanged. Check your local .env if you need to recover them.",
          ),
        );
      }
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
