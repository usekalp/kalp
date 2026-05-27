import fs from "node:fs";
import { parseSync } from "@swc/core";
import type { Module } from "@swc/core";
import { detectPrimitives } from "./primitive-detector";
import { inferSemanticName } from "./semantic-inference";
import { normalizeCallForHash, stableHashNormalized } from "./ast-normalizer";
import { generatePrimitiveId } from "./primitive-id";
import { findExportPosition, findHandlerBodyOffset } from "./source-locations";
import type { HandlerSourceAnalysis, PrimitiveCallSite } from "./types";

export function analyzeHandlerSource(
  source: string,
  filePath: string,
  relativePath: string,
  exportName: string,
  stableName: string,
  nodeId: string,
): HandlerSourceAnalysis | null {
  const exportPos = findExportPosition(source, exportName);
  const handlerLine = exportPos?.line ?? 1;
  const handlerColumn = exportPos?.column ?? 0;

  const handlerBodyRange = findHandlerBodyOffset(source, exportName);

  let startOffset = 0;
  let endOffset = source.length;
  if (handlerBodyRange) {
    startOffset = handlerBodyRange.start;
    endOffset = handlerBodyRange.end;
  } else if (exportPos) {
    const exportOffset = positionToOffset(source, exportPos.line, exportPos.column);
    if (exportOffset !== null) {
      startOffset = exportOffset;
    }
  }

  const detections = detectPrimitives(source, startOffset, endOffset);

  const primitives: PrimitiveCallSite[] = detections.map((detection) => {
    let semanticName: string | null = null;
    let inferenceSource: "variable" | "string-literal" | "hash" = "hash";

    let ast: Module | null = null;
    try {
      ast = parseSync(source, { syntax: "typescript", target: "es2022" });
    } catch {}

    const callNode = ast ? findCallBySpan(ast, detection.callExprSpan.start, detection.callExprSpan.end) : null;
    const parentNode = ast ? findParentOfSpan(ast, detection.callExprSpan.start, detection.callExprSpan.end) : null;

    if (callNode) {
      const inference = inferSemanticName(
        callNode,
        parentNode,
        detection.parentDeclaratorId,
        detection.firstArgStringValue,
      );
      semanticName = inference.semanticName;
      inferenceSource = inference.inferenceSource;
    } else {
      if (detection.parentDeclaratorId) {
        semanticName = detection.parentDeclaratorId;
        inferenceSource = "variable";
      } else if (detection.firstArgStringValue) {
        semanticName = detection.firstArgStringValue;
        inferenceSource = "string-literal";
      }
    }

    const normalized = normalizeCallForHash({
      callee: detection.primitiveType,
      args: detection.argPreview.argsCount > 0 && detection.firstArgType
        ? [{ type: detection.firstArgType, value: detection.firstArgStringValue ?? undefined }]
        : [],
    });
    const fallbackHash = stableHashNormalized(normalized);

    const primitiveId = generatePrimitiveId({
      handlerStableName: stableName,
      namespace: detection.namespace,
      method: detection.method,
      semanticName,
      fallbackHash,
    });

    return {
      namespace: detection.namespace,
      method: detection.method,
      primitiveType: detection.primitiveType,
      line: detection.line,
      column: detection.column,
      semanticName,
      inferenceSource,
      primitiveId,
      argPreview: detection.argPreview,
    };
  });

  return {
    filePath,
    relativePath,
    exportName,
    stableName,
    nodeId,
    handlerLine,
    handlerColumn,
    primitives,
  };
}

export function analyzeHandlerFile(
  filePath: string,
  relativePath: string,
  exportName: string,
  stableName: string,
  nodeId: string,
): HandlerSourceAnalysis | null {
  let source: string;
  try {
    source = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  return analyzeHandlerSource(
    source,
    filePath,
    relativePath,
    exportName,
    stableName,
    nodeId,
  );
}

function findCallBySpan(node: unknown, start: number, end: number): any | null {
  if (!node || typeof node !== "object") return null;
  if (typeof (node as any).type === "string" && (node as any).span) {
    const span = (node as any).span;
    if (span.start === start && span.end === end) {
      return node;
    }
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findCallBySpan(item, start, end);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      const found = findCallBySpan(value, start, end);
      if (found) return found;
    }
  }
  return null;
}

function findParentOfSpan(node: unknown, start: number, end: number): any | null {
  if (!node || typeof node !== "object") return null;
  for (const value of Object.values(node as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && typeof (item as any).type === "string" && (item as any).span) {
          const span = (item as any).span;
          if (span.start <= start && span.end >= end && !(span.start === start && span.end === end)) {
            const deeper = findParentOfSpan(item, start, end);
            if (deeper) return deeper;
            return item;
          }
        }
      }
      for (const item of value) {
        const found = findParentOfSpan(item, start, end);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      const found = findParentOfSpan(value, start, end);
      if (found) return found;
    }
  }
  return null;
}

function positionToOffset(source: string, line: number, column: number): number | null {
  let currentLine = 1;
  let lineStartOffset = 0;

  for (let i = 0; i < source.length; i++) {
    if (currentLine === line) {
      return lineStartOffset + column;
    }
    if (source[i] === "\n") {
      currentLine++;
      lineStartOffset = i + 1;
    }
  }

  if (currentLine === line) {
    return lineStartOffset + column;
  }

  return null;
}