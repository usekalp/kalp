import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { execa } from "execa";
import {
  getCloudflareIdentity,
  saveAuthConfig,
  type AuthConfig,
} from "@/utils/auth";

const LOGO = "🦋";

export default defineCommand({
  meta: { name: "login", description: "Authenticate with Cloudflare" },
  async run() {
    p.intro(`${LOGO} ${pc.bold("kalp login")}`);

    const provider = await p.select({
      message: "Choose login provider",
      options: [
        { label: "Cloudflare (Recommended)", value: "cloudflare" },
        { label: "Kalp Cloud", value: "kalp-cloud" },
      ],
    });

    if (p.isCancel(provider)) {
      p.outro("Cancelled");
      return;
    }

    if (provider === "kalp-cloud") {
      p.note(
        "Coming soon. Enterprise cloud execution is currently waitlisted.",
        "Kalp Cloud",
      );
      p.outro(pc.dim("No login executed."));
      return;
    }

    const s = p.spinner();
    s.start("Opening Cloudflare OAuth login");

    try {
      await execa("npx", ["wrangler", "login"], {
        stdio: "inherit",
      });
    } catch {
      s.stop(pc.red("Cloudflare login failed"));
      process.exit(1);
    }

    s.stop("Cloudflare login complete");
    s.start("Reading Cloudflare identity");
    const identity = await getCloudflareIdentity();
    const account = identity?.accounts?.[0];
    const accountId = account?.id ?? account?.account_tag;
    const email = identity?.email;

    if (!accountId || !email) {
      s.stop(pc.red("Could not resolve account identity from wrangler whoami"));
      process.exit(1);
    }

    const authConfig: AuthConfig = {
      provider: "cloudflare",
      accountId,
      email,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    await saveAuthConfig(authConfig);

    s.stop("Cloudflare authentication saved");
    p.log.success(`Logged in as ${pc.cyan(authConfig.email)}`);
    p.note(`Account ID: ${pc.cyan(authConfig.accountId)}`, "Cloudflare");
    p.outro(pc.green("Ready to deploy with Cloudflare Workers"));
  },
});
