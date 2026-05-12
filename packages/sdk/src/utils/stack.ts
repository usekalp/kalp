import { normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Utility to capture the file path of the caller using stack traces.
 * This is used by the SDK registry to attach __filePath metadata to nodes.
 */

function normalizeCapturedPath(rawPath: string): string {
  let path = rawPath;

  if (path.startsWith("file:///")) {
    path = fileURLToPath(path);
  }

  if (process.platform === "win32") {
    // Git Bash/MSYS format: /c/Users/... -> C:/Users/...
    const driveStyle = path.match(/^\/([a-zA-Z])\/(.*)$/);
    if (driveStyle) {
      path = `${driveStyle[1]}:/${driveStyle[2]}`;
    } else if (path.startsWith("/Users/")) {
      // Defensive fallback seen in some stacks running on Windows shells
      path = `C:${path}`;
    }
  }

  return normalize(path).split(sep).join("/");
}

/**
 * Extract the first file path from a stack trace string that isn't from the SDK itself.
 * Supports Node.js, Vite, tsx, Jiti and similar stack formats.
 */
export function extractFilePath(stack?: string): string | undefined {
  if (!stack) return undefined;

  const lines = stack.split(/\r?\n/);

  for (const line of lines) {
    const normalizedLine = line.replace(/\\/g, "/");

    // Skip frames from this utility or the SDK's core registration logic
    if (
      normalizedLine.includes("captureFilePath") ||
      normalizedLine.includes("extractFilePath") ||
      normalizedLine.includes("registerNode") ||
      normalizedLine.includes("defineStep") ||
      normalizedLine.includes("defineTool") ||
      normalizedLine.includes("defineRoute") ||
      normalizedLine.includes("defineListener") ||
      normalizedLine.includes("@kalphq/sdk/") ||
      normalizedLine.includes("/packages/sdk/") ||
      normalizedLine.includes("Error")
    ) {
      continue;
    }

    const patterns = [
      /\((file:\/\/\/[^\s)]+|[A-Za-z]:\\[^:]+|\/[^:]+):\d+:\d+\)/,
      /at\s+(file:\/\/\/[^\s)]+|[A-Za-z]:\\[^:]+|\/[^:]+):\d+:\d+/,
      /(file:\/\/\/[^\s)]+|[A-Za-z]:\\[^:]+|\/[^:]+):\d+:\d+/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match?.[1]) continue;

      return normalizeCapturedPath(match[1]);
    }
  }

  return undefined;
}

/**
 * Capture the file path of the immediate caller.
 * Creates a new Error to obtain the stack and parses it.
 */
export function captureFilePath(): string | undefined {
  // Use a large stack trace limit to ensure we see the caller
  const oldLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 20;
  const err = new Error();
  const stack = err.stack;
  Error.stackTraceLimit = oldLimit;

  return extractFilePath(stack);
}
