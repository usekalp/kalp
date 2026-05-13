import * as p from "@clack/prompts";
import pc from "picocolors";

export type DeployTarget = "cloudflare" | "kalp-cloud";

export async function promptDeployTarget(message: string): Promise<DeployTarget | null> {
  const selected = await p.select({
    message,
    options: [
      {
        value: "cloudflare",
        label: "Cloudflare",
        hint: "Available now",
      },
      {
        value: "kalp-cloud",
        label: "Kalp Cloud",
        hint: "Coming soon",
      },
    ],
  });

  if (p.isCancel(selected)) return null;
  return selected as DeployTarget;
}

export function showKalpCloudWaitlist(): void {
  p.note(
    [
      `${pc.bold("Kalp Cloud is coming soon 🚀")}`,
      pc.dim("Join the waitlist for early access:"),
      pc.cyan("https://usekalp.com/waitlist"),
    ].join("\n"),
    "Kalp Cloud",
  );
}
