import { parseSync } from "@swc/core";
import type { Module, CallExpression, MemberExpression, Identifier, Span } from "@swc/core";
import { isKnownPrimitive } from "./primitive-catalog";
import type { PrimitiveDetection } from "./types";

export function detectPrimitives(
  source: string,
  handlerStartOffset: number,
  handlerEndOffset: number,
): PrimitiveDetection[] {
  let ast: Module;
  try {
    ast = parseSync(source, {
      syntax: "typescript",
      target: "es2022",
    });
  } catch {
    return [];
  }

  const detections: PrimitiveDetection[] = [];

  walkForPrimitiveCalls(
    ast,
    source,
    handlerStartOffset,
    handlerEndOffset,
    null,
    null,
    detections,
  );

  return detections;
}

function walkForPrimitiveCalls(
  node: unknown,
  source: string,
  startOffset: number,
  endOffset: number,
  parent: unknown,
  parentDeclaratorId: string | null,
  detections: PrimitiveDetection[],
): void {
  if (!node || typeof node !== "object") return;

  if (typeof (node as any).type === "string") {
    const nodeType = (node as any).type;
    const span = (node as any).span as Span | undefined;

    if (span && span.start >= startOffset && span.end <= endOffset && nodeType === "CallExpression") {
      const callExpr = node as CallExpression;
      const result = tryDetectPrimitive(callExpr, source, parent, parentDeclaratorId);
      if (result) {
        detections.push(result);
      }
    }

    if (nodeType === "VariableDeclarator") {
      const id = (node as any).id;
      if (id && id.type === "Identifier") {
        parentDeclaratorId = id.value;
      }
    }
  }

  for (const value of Object.values(node as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        walkForPrimitiveCalls(item, source, startOffset, endOffset, node, parentDeclaratorId, detections);
      }
    } else if (value && typeof value === "object") {
      walkForPrimitiveCalls(value, source, startOffset, endOffset, node, parentDeclaratorId, detections);
    }
  }
}

function tryDetectPrimitive(
  callExpr: CallExpression,
  source: string,
  parent: unknown,
  parentDeclaratorId: string | null,
): PrimitiveDetection | null {
  const callee = callExpr.callee;
  if (callee.type !== "MemberExpression") return null;

  const resolved = resolveCallee(callee);
  if (!resolved) return null;

  const { namespace, method, server, primitiveType } = resolved;

  if (!isKnownPrimitive(namespace, method)) return null;

  const span = callExpr.span;
  const firstArg = callExpr.arguments[0]?.expression;
  const firstArgType = firstArg?.type ?? null;
  const firstArgStringValue = extractFirstArgStringValue(firstArg);

  let line = 1;
  let column = 0;
  for (let i = 0; i < span.start && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
  }

  return {
    namespace,
    method,
    primitiveType: server ? `mcp.${method}` : primitiveType,
    line,
    column,
    argPreview: {
      argsCount: callExpr.arguments.length,
      firstArgType: firstArgType ?? undefined,
    },
    callExprSpan: { start: span.start, end: span.end },
    parentSpan: (parent as any)?.span
      ? { start: (parent as any).span.start, end: (parent as any).span.end }
      : null,
    parentType: (parent as any)?.type ?? null,
    parentDeclaratorId,
    firstArgType,
    firstArgStringValue,
    ...(server ? { server } : {}),
  };
}

interface CalleeResolution {
  namespace: string;
  method: string;
  server?: string;
  primitiveType: string;
}

function resolveCallee(callee: MemberExpression): CalleeResolution | null {
  const parts: string[] = [];
  let current: MemberExpression | Identifier = callee;

  while (current.type === "MemberExpression") {
    if (current.property.type !== "Identifier") return null;
    parts.unshift(current.property.value);
    current = current.object as MemberExpression | Identifier;
  }

  if (current.type === "Identifier") {
    parts.unshift(current.value);
  }

  if (parts.length < 3 || parts[0] !== "ctx") return null;

  const namespace = parts[1];
  if (!namespace) return null;

  if (namespace === "mcp" && parts.length >= 4) {
    const server = parts[2];
    const method = parts.slice(3).join(".");
    return {
      namespace: "mcp",
      method,
      server: server ?? undefined,
      primitiveType: `mcp.${method}`,
    };
  }

  const method = parts.slice(2).join(".");
  if (!method) return null;
  return {
    namespace,
    method,
    primitiveType: `${namespace}.${method}`,
  };
}

function extractFirstArgStringValue(firstArg: unknown): string | null {
  if (!firstArg || typeof firstArg !== "object") return null;
  if ((firstArg as any).type === "StringLiteral") {
    return (firstArg as any).value ?? null;
  }
  return null;
}