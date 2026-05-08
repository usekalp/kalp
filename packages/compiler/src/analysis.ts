/**
 * Analyzes bundled handler code for prohibited patterns or potential risks.
 */
export function analyzeHandler(code: string): {
  capabilities: string[];
  imports: { external: string[]; internal: string[] };
  blockers: string[];
  warnings: string[];
} {
  const capabilities: string[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const imports = { external: [] as string[], internal: [] as string[] };

  // Security Check: eval and Function constructor
  if (/eval\s*\(/.test(code)) {
    blockers.push("Use of 'eval' is prohibited for security reasons.");
  }
  if (/new\s+Function\s*\(/.test(code)) {
    blockers.push("Use of 'new Function' is prohibited for security reasons.");
  }

  // Environment Check: Node-specific globals
  // We allow 'process.env' (common for library environment checks like Zod)
  // but block actual Node runtime control APIs
  if (
    /\bprocess\.(nextTick|exit|stdout|stderr|stdin|cwd|chdir|kill)\b/.test(code)
  ) {
    blockers.push(
      "Reference to Node.js-specific process APIs found. Handlers must be environment-agnostic.",
    );
  }

  if (
    /\bprocess\b/.test(code) &&
    !code.includes("process.env") &&
    !code.includes("typeof process")
  ) {
    warnings.push(
      "Potential reference to 'process' found. Ensure your code does not depend on Node.js globals.",
    );
  }

  // Capabilities Detection
  if (/\bfetch\s*\(/.test(code)) {
    capabilities.push("network");
    warnings.push(
      "Direct use of 'fetch' found. Ensure network access is permitted for this agent.",
    );
  }

  if (/\bsetTimeout\b|\bsetInterval\b/.test(code)) {
    capabilities.push("timers");
    warnings.push(
      "Timers found. Ensure they are compatible with the target runtime lifecycle.",
    );
  }

  // Basic import tracking (from bundled code, this is limited)
  // We look for common package patterns in the bundle
  if (code.includes('require("path")') || code.includes('require("fs")')) {
    imports.external.push("node-primitives");
    blockers.push(
      "Node.js core modules (fs, path) are not allowed in handlers.",
    );
  }

  return { capabilities, imports, blockers, warnings };
}

/**
 * Validates the structural integrity of the generated IR.
 *
 * The IR v3 format has:
 * - metadata: { name, systemPrompt?, metadata? }
 * - entries: Record<string, IRNodeId>
 * - bundles: Record<string, { code: string }>
 */
export function validateIR(ir: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!ir || typeof ir !== "object") {
    errors.push("IR must be a valid JSON object.");
    return { valid: false, errors };
  }

  // Check metadata
  if (!ir.metadata || typeof ir.metadata !== "object") {
    errors.push("Missing 'metadata' object in IR.");
  } else {
    if (!ir.metadata.name)
      errors.push("IR metadata must have a 'name' property.");
  }

  // Check entries
  if (!ir.entries || typeof ir.entries !== "object") {
    errors.push("Missing 'entries' object in IR.");
  }

  // Check bundles
  if (!ir.bundles || typeof ir.bundles !== "object") {
    errors.push("Missing 'bundles' object in IR.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Ensures all handler references in the IR are present in the provided bundle.
 *
 * The IR v3 format uses:
 * - entries: Record<string, string> - maps entry keys (e.g., "steps.create_ticket", "GET:/health", "onMessage") to handler hashes
 * - bundles: Record<string, { code: string }> - maps handler hashes to code
 */
export function validateIRBindings(
  ir: any,
  _handlerNames: string[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check that all bundles referenced by entries exist
  if (ir.entries && typeof ir.entries === "object") {
    for (const [entryKey, handlerHash] of Object.entries(ir.entries) as [
      string,
      string,
    ][]) {
      // Validate the entry key format - should be "kind.id" for steps/tools/routes/hooks
      // or event names like "onMessage", "onCall", "GET:/health"
      const isValidEntryKey =
        /^[a-z_]+\.[a-z_]+$/.test(entryKey) || // kind.id format
        /^(onMessage|onCall|onInit|onTick)$/.test(entryKey) || // lifecycle hooks
        /^(GET|POST|PUT|DELETE|PATCH):\//.test(entryKey); // routes

      if (!isValidEntryKey) {
        // If it doesn't match expected patterns, it might be an event name
        // Just check that the hash exists
      }

      // Check that the handler hash exists in bundles
      if (!handlerHash || typeof handlerHash !== "string") {
        errors.push(`Invalid handler hash for entry: ${entryKey}`);
        continue;
      }

      if (!ir.bundles || !ir.bundles[handlerHash]) {
        errors.push(`Bundle missing: ${handlerHash} for entry ${entryKey}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
