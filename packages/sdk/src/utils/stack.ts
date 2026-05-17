import { normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

function normalizeCapturedPath(rawPath: string): string {
  let path = rawPath;

  if (path.startsWith("file:///")) {
    path = fileURLToPath(path);
  }

  if (process.platform === "win32") {
    const driveStyle = path.match(/^\/([a-zA-Z])\/(.*)$/);
    if (driveStyle) {
      path = `${driveStyle[1]}:/${driveStyle[2]}`;
    } else if (path.startsWith("/Users/")) {
      path = `C:${path}`;
    }
  }

  return normalize(path).split(sep).join("/");
}

export function extractFilePath(stack?: string): string | undefined {
  if (!stack) return undefined;

  const lines = stack.split(/\r?\n/);

  for (const line of lines) {
    const normalizedLine = line.replace(/\\/g, "/");

    if (
      normalizedLine.includes("captureFilePath") ||
      normalizedLine.includes("extractFilePath") ||
      normalizedLine.includes("registerNode") ||
      normalizedLine.includes("defineTool") ||
      normalizedLine.includes("defineRoute") ||
      normalizedLine.includes("defineListener") ||
      normalizedLine.includes("defineHook") ||
      normalizedLine.includes("defineCron") ||
      normalizedLine.includes("defineContract") ||
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

export function captureFilePath(): string | undefined {
  const oldLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 20;
  const err = new Error();
  const stack = err.stack;
  Error.stackTraceLimit = oldLimit;

  return extractFilePath(stack);
}
