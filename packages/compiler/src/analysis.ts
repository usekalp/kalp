// packages/compiler/src/analysis.ts

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
  if (/\bprocess\b/.test(code) && !code.includes("typeof process")) {
    blockers.push("Reference to 'process' found. Handlers must be environment-agnostic.");
  }
  
  // Capabilities Detection
  if (/\bfetch\s*\(/.test(code)) {
    capabilities.push("network");
    warnings.push("Direct use of 'fetch' found. Ensure network access is permitted for this agent.");
  }

  if (/\bsetTimeout\b|\bsetInterval\b/.test(code)) {
    capabilities.push("timers");
    warnings.push("Timers found. Ensure they are compatible with the target runtime lifecycle.");
  }

  // Basic import tracking (from bundled code, this is limited)
  // We look for common package patterns in the bundle
  if (code.includes('require("path")') || code.includes('require("fs")')) {
    imports.external.push("node-primitives");
    blockers.push("Node.js core modules (fs, path) are not allowed in handlers.");
  }

  return { capabilities, imports, blockers, warnings };
}

/**
 * Validates the structural integrity of the generated IR.
 */
export function validateIR(ir: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!ir || typeof ir !== "object") {
    errors.push("IR must be a valid JSON object.");
    return { valid: false, errors };
  }

  if (!ir.agent || typeof ir.agent !== "object") {
    errors.push("Missing 'agent' metadata in IR.");
  } else {
    if (!ir.agent.name) errors.push("Agent must have a name.");
  }

  if (!ir.steps || typeof ir.steps !== "object") {
    errors.push("Missing 'steps' object in IR.");
  }

  if (!ir.tools || typeof ir.tools !== "object") {
    errors.push("Missing 'tools' object in IR.");
  }

  if (!ir.routes || typeof ir.routes !== "object") {
    errors.push("Missing 'routes' object in IR.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Ensures all handler references in the IR are present in the provided bundle.
 */
export function validateIRBindings(
  ir: any,
  handlerNames: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const bundleSet = new Set(handlerNames);

  function checkHandler(file?: string, sourceId?: string) {
    if (!file) return;
    
    // In our buildAgent, handlerFile is "./handlers/[name].[hash].js"
    const filename = file.split("/").pop();
    if (!filename) return;
    
    // The platform sends handlerNames as the keys in the bundle object.
    // In buildAgent, the key is the full filename (e.g. step1.abc.js).
    const exists = handlerNames.some(name => name === filename);
    if (!exists) {
      errors.push(`Handler binding missing: ${file} for ${sourceId}`);
    }
  }

  // Check steps
  if (ir.steps) {
    for (const [id, step] of Object.entries(ir.steps) as any) {
      checkHandler(step.handlerFile, `step:${id}`);
    }
  }

  // Check tools
  if (ir.tools) {
    for (const [id, tool] of Object.entries(ir.tools) as any) {
      checkHandler(tool.handlerFile, `tool:${id}`);
    }
  }

  // Check routes
  if (ir.routes) {
    for (const [id, route] of Object.entries(ir.routes) as any) {
      checkHandler(route.handlerFile, `route:${id}`);
    }
  }

  // Check hooks
  if (ir.agent?.hooks) {
    for (const [id, hook] of Object.entries(ir.agent.hooks) as any) {
      checkHandler(hook.handlerFile, `hook:${id}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
