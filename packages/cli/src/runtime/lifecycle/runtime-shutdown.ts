import { execSync } from "node:child_process";
import os from "node:os";

export interface ShutdownHandle {
  trigger: () => void;
}

export function setupShutdown(
  onShutdown: () => Promise<void>,
  log?: (msg: string) => void,
): ShutdownHandle {
  let shuttingDown = false;

  const killWorkerdZombies = () => {
    try {
      if (os.platform() === "win32") {
        execSync("taskkill /F /IM workerd.exe /T 2>nul", { stdio: "ignore", timeout: 3000 });
      } else {
        execSync("pkill -9 workerd 2>/dev/null", { stdio: "ignore", timeout: 3000 });
      }
    } catch {
      // workerd not running — ignore
    }
  };

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    log?.("Shutting down...");

    // Kill workerd FIRST — releases ports and unblocks event loop
    killWorkerdZombies();

    try {
      await onShutdown();
    } catch {
      // ignore cleanup errors at this point
    } finally {
      process.exit(0);
    }
  }

  // Signal handlers — works in PowerShell, CMD, Git Bash, Linux, Mac
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  // Fallback: when stdin is in raw mode (e.g., @clack/prompts doesn't restore it on Windows),
  // Ctrl+C sends byte 0x03 as data instead of generating SIGINT.
  process.stdin.on("data", (data: Buffer) => {
    if (data.includes(0x03)) void shutdown();
  });

  return { trigger: () => void shutdown() };
}

