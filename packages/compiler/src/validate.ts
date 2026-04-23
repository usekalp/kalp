import { z } from "zod";
import type { IRGraph, IRNodeId } from "@kalphq/sdk";

// Primitive schemas

const IRNodeIdSchema = z.string().min(1);

// Node schemas

const EntryIRNodeSchema = z.object({
  kind: z.literal("entry"),
  id: IRNodeIdSchema,
  handler: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z.string().optional(),
});

const RunIRNodeSchema = z.object({
  kind: z.literal("run"),
  id: IRNodeIdSchema,
  targetId: z.string().min(1),
  targetKind: z.enum(["step", "tool"]),
  input: z.unknown().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
});

const WaitIRNodeSchema = z.object({
  kind: z.literal("wait"),
  id: IRNodeIdSchema,
  duration: z.union([z.string(), z.number()]),
});

const FetchIRNodeSchema = z.object({
  kind: z.literal("fetch"),
  id: IRNodeIdSchema,
  url: z.string().min(1),
  init: z.unknown().optional(),
});

const GenerateIRNodeSchema = z.object({
  kind: z.literal("llm.generate"),
  id: IRNodeIdSchema,
  model: z.string().optional(),
  input: z.unknown(),
  schema: z.unknown().optional(),
});

const StreamIRNodeSchema = z.object({
  kind: z.literal("llm.stream"),
  id: IRNodeIdSchema,
  model: z.string().optional(),
  input: z.unknown(),
  schema: z.unknown().optional(),
});

const ClassifyIRNodeSchema = z.object({
  kind: z.literal("llm.classify"),
  id: IRNodeIdSchema,
  model: z.string().optional(),
  input: z.object({
    text: z.string(),
    labels: z.array(z.string()),
  }),
  branches: z.array(
    z.object({
      label: z.string(),
      next: IRNodeIdSchema.optional(),
    }),
  ),
  fallback: IRNodeIdSchema.optional(),
  confidenceThreshold: z.number().optional(),
});

const LoopIRNodeSchema = z.object({
  kind: z.literal("loop"),
  id: IRNodeIdSchema,
  entry: IRNodeIdSchema,
  detached: z.literal(true),
  key: z.string().optional(),
  schedule: z.object({
    type: z.enum(["interval", "cron", "event-driven"]),
    value: z.union([z.string(), z.number()]).optional(),
  }),
  lifecycle: z.object({
    onStart: IRNodeIdSchema.optional(),
    onIterationStart: IRNodeIdSchema.optional(),
    onIterationEnd: IRNodeIdSchema.optional(),
    onError: IRNodeIdSchema.optional(),
    onStop: IRNodeIdSchema.optional(),
  }),
  maxIterations: z.number().optional(),
  until: IRNodeIdSchema.optional(),
  persistent: z.literal(true),
});

export const IRNodeSchema = z.discriminatedUnion("kind", [
  EntryIRNodeSchema,
  RunIRNodeSchema,
  WaitIRNodeSchema,
  FetchIRNodeSchema,
  GenerateIRNodeSchema,
  StreamIRNodeSchema,
  ClassifyIRNodeSchema,
  LoopIRNodeSchema,
]);

// Graph schema

export const IREdgeSchema = z.object({
  from: IRNodeIdSchema,
  to: IRNodeIdSchema,
  type: z.enum(["sequential", "branch", "nested"]),
  condition: z.string().optional(),
});

export const IRGraphSchema = z.object({
  agentId: z.string().min(1),
  entries: z.record(IRNodeIdSchema),
  nodes: z.record(IRNodeSchema),
  edges: z.array(IREdgeSchema),
});

// Validation functions

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export function validateIR(ir: unknown): ValidationResult {
  const result = IRGraphSchema.safeParse(ir);
  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { valid: false, errors };
}

export function validateIRBindings(
  ir: IRGraph,
  handlerNames: string[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const handlerSet = new Set(handlerNames);

  // Run nodes: targetId must match a handler key directly
  for (const node of Object.values(ir.nodes)) {
    if (node.kind === "run") {
      if (!handlerSet.has(node.targetId)) {
        errors.push(
          `IR references "${node.targetId}" (${node.targetKind}) but no handler bundled for it`,
        );
      }
    }
  }

  // Entry handlers: routes skipped (no handler in v1), all others must be bundled
  for (const [entryKey, entryNodeId] of Object.entries(ir.entries)) {
    if (entryKey.startsWith("route:")) continue;
    if (!handlerSet.has(entryKey)) {
      errors.push(`Entry "${entryKey}" declared in IR but not bundled`);
    }
    if (!ir.nodes[entryNodeId as IRNodeId]) {
      errors.push(
        `Entry "${entryKey}" points to missing node "${entryNodeId}"`,
      );
    }
  }

  // Orphan detection (warning only — handlers may be reusable but unused in current IR)
  const referencedHandlers = new Set<string>();
  for (const node of Object.values(ir.nodes)) {
    if (node.kind === "run") {
      referencedHandlers.add(node.targetId);
    }
  }
  for (const k of Object.keys(ir.entries)) {
    if (!k.startsWith("route:")) {
      referencedHandlers.add(k);
    }
  }

  for (const name of handlerNames) {
    if (!referencedHandlers.has(name)) {
      warnings.push(
        `Handler "${name}" is bundled but not referenced in IR (orphan)`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
