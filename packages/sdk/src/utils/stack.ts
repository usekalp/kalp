/**
 * Utility to capture the file path of the caller using stack traces.
 * This is used by the SDK registry to attach __filePath metadata to nodes.
 */

/**
 * Extract the first file path from a stack trace string that isn't from the SDK itself.
 * Supports Node.js, Vite, tsx, Jiti and similar stack formats.
 */
export function extractFilePath(stack?: string): string | undefined {
  if (!stack) return undefined;

  const lines = stack.split(/\r?\n/);

  for (const line of lines) {
    // Skip frames from this utility or the SDK's core registration logic
    if (
      line.includes("captureFilePath") ||
      line.includes("extractFilePath") ||
      line.includes("registerNode") ||
      line.includes("defineStep") ||
      line.includes("defineTool") ||
      line.includes("defineRoute") ||
      line.includes("Error")
    ) {
      continue;
    }

    // Match file paths. We look for absolute paths or file URIs.
    // We want to stop before the first colon that starts the line number.
    // Patterns:
    // - (C:\path\to\file.ts:10:5)
    // - at /path/to/file.ts:10:5
    // - file:///C:/path/to/file.ts:10:5

    // Improved regex to capture the path. It looks for something that looks like a path
    // and ends before a colon followed by a number.
    const match = line.match(/(?:file:\/\/\/|\/|[A-Za-z]:[\\/])(?:(?![ :]).)+/);

    if (match) {
      let path = match[0];

      // Clean up file URIs
      if (path.startsWith("file:///")) {
        path = path.replace("file:///", "");
        // Windows file:///C:/... becomes /C:/... -> remove leading slash
        if (/^\/[A-Za-z]:/.test(path)) {
          path = path.substring(1);
        }
      }

      // Normalize backslashes to forward slashes
      path = path.replace(/\\/g, "/");

      return path;
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
