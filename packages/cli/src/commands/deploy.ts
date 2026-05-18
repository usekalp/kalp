import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { generateTypes } from "@/utils/codegen";
import { requireAuth } from "@/utils/auth";
import { runInitialDeploy } from "@/utils/deploy";
import {
  promptDeployTarget,
  showKalpCloudWaitlist,
} from "@/utils/deploy-target";

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

    const target = await promptDeployTarget(
      "Choose where to deploy your runtime",
    );
    if (!target) {
      p.outro("Cancelled");
      return;
    }
    if (target === "kalp-cloud") {
      showKalpCloudWaitlist();
      p.outro(pc.green("Got it — you'll hear from us soon."));
      return;
    }

    const s = p.spinner();
    s.start("Generating types");
    await generateTypes(cwd);
    s.message("Deploying your agents runtime");

    try {
      const result = await runInitialDeploy(cwd);
      s.stop("Deployment completed");
      p.log.success(`Runtime URL: ${pc.cyan(result.workerUrl)}`);
      if (result.customDomains.length > 0) {
        p.note(
          result.customDomains
            .map((domain) => pc.cyan(`https://${domain}`))
            .join("\n"),
          "Custom domains detected",
        );
      }

      const preferredStudioBase =
        result.customDomains.length > 0
          ? `https://${result.customDomains[0]}`
          : result.workerUrl;

      if (result.credentialsChanged || result.serviceKeyChanged) {
        p.log.info(pc.bold("Admin access"));
        console.log(
          `  ${pc.dim("Username:")} ${pc.cyan(result.studioAdminUser)}`,
        );
        console.log(
          `  ${pc.dim("Password:")} ${pc.cyan(result.studioPassword)}`,
        );
        console.log(
          `  ${pc.dim("Service key:")} ${pc.cyan(`Bearer ${result.serviceKey}`)}`,
        );
        console.log(
          `  ${pc.dim("Studio URL:")} ${pc.cyan(`${preferredStudioBase.replace(/\/$/, "")}/studio/login`)}`,
        );
      } else {
        p.log.info(
          pc.dim(
            "Credentials unchanged. Check your local .env if you need to recover them.",
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
