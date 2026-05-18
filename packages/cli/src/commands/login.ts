import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  saveAuthConfig,
  type AuthConfig,
} from "@/utils/auth";
import { resolveProvider } from "@/utils/providers";
import { promptDeployTarget, showKalpCloudWaitlist } from "@/utils/deploy-target";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "login", description: "Sign in to remote runtime" },
  async run() {
    p.intro(`${LOGO} ${pc.bold("kalp login")}`);

    const target = await promptDeployTarget("Where do you want to sign in?");
    if (!target) {
      p.outro("Cancelled");
      return;
    }

    if (target === "kalp-cloud") {
      showKalpCloudWaitlist();
      return;
    }

    const provider = resolveProvider();

    const s = p.spinner();
    s.start("Opening sign-in flow");

    try {
      await provider.login();
    } catch {
      s.stop(pc.red("Sign-in failed"));
      process.exit(1);
    }

    s.stop("Sign-in complete");

    const s2 = p.spinner();
    s2.start("Reading runtime identity");
    const identity = await provider.whoami();
    const accountId = identity?.accountId;
    const email = identity?.email;

    if (!accountId || !email) {
      s2.stop(pc.red("Could not resolve account identity"));
      process.exit(1);
    }

    const authConfig: AuthConfig = {
      provider: "cloudflare",
      accountId,
      email,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    await saveAuthConfig(authConfig);

    s2.stop("Authentication saved");
    p.log.success(`Logged in as ${pc.cyan(authConfig.email)}`);
    p.note(`Workspace ID: ${pc.cyan(authConfig.accountId)}`, "Runtime");
    p.outro(pc.green("Ready to deploy your agents"));
  },
});
