import type { BundleManifest, IRGraph, SchemaRegistry } from "@kalphq/sdk";

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

  if (/eval\s*\(/.test(code)) {
    blockers.push("Use of 'eval' is prohibited for security reasons.");
  }
  if (/new\s+Function\s*\(/.test(code)) {
    blockers.push("Use of 'new Function' is prohibited for security reasons.");
  }

  if (/\bprocess\.(nextTick|exit|stdout|stderr|stdin|cwd|chdir|kill)\b/.test(code)) {
    blockers.push(
      "Reference to Node.js-specific process APIs found. Handlers must be environment-agnostic.",
    );
  }

  if (/\bprocess\b/.test(code) && !code.includes("process.env") && !code.includes("typeof process")) {
    warnings.push(
      "Potential reference to 'process' found. Ensure your code does not depend on Node.js globals.",
    );
  }

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

  if (code.includes('require("path")') || code.includes('require("fs")')) {
    imports.external.push("node-primitives");
    blockers.push("Node.js core modules (fs, path) are not allowed in handlers.");
  }

  return { capabilities, imports, blockers, warnings };
}

export function validateIR(ir: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!ir || typeof ir !== "object") {
    errors.push("IR must be a valid JSON object.");
    return { valid: false, errors };
  }

  if (ir.schemaVersion !== 3) {
    errors.push(
      `Unsupported IR schemaVersion "${String(ir.schemaVersion)}". Expected schemaVersion 3.`,
    );
    return { valid: false, errors };
  }

  if (!ir.agent || typeof ir.agent !== "object") {
    errors.push("Missing 'agent' object in IR.");
  } else if (typeof ir.agent.name !== "string") {
    errors.push("IR agent must have a 'name' property.");
  }

  if (!ir.nodes || typeof ir.nodes !== "object" || Array.isArray(ir.nodes)) {
    errors.push("Missing 'nodes' object in IR.");
  }

  return { valid: errors.length === 0, errors };
}

export function validateIRBindings(
  ir: IRGraph,
  bundleManifest: BundleManifest,
  schemas: SchemaRegistry,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const target = bundleManifest.targets.default;

  if (!target) {
    errors.push("Bundle manifest is missing targets.default.");
    return { valid: false, errors };
  }

  const stableNames = new Set<string>();
  for (const [nodeId, node] of Object.entries(ir.nodes)) {
    if (!target.nodes[nodeId]) {
      errors.push(`Bundle mapping missing for node ${nodeId}`);
    }

    if (!node.id || node.id !== nodeId) {
      errors.push(`Node ${nodeId} must expose a matching opaque id.`);
    }

    if (!node.stableName) {
      errors.push(`Node ${nodeId} is missing stableName.`);
    } else if (stableNames.has(node.stableName)) {
      errors.push(`Duplicate stableName detected: ${node.stableName}`);
    } else {
      stableNames.add(node.stableName);
    }

    for (const schemaId of [node.inputSchema, node.outputSchema]) {
      if (schemaId && !schemas[schemaId]) {
        errors.push(`Missing schema ref ${schemaId} for node ${nodeId}`);
      }
    }
  }

  if (ir.agent.stateSchema && !schemas[ir.agent.stateSchema]) {
    errors.push(`Missing state schema ref ${ir.agent.stateSchema}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

