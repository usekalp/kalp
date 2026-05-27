import type { CallExpression } from "@swc/core";
import type { SemanticInferenceResult } from "./types";

export function inferSemanticName(
  _callExpr: CallExpression,
  _parent: unknown,
  parentDeclaratorId: string | null,
  firstArgStringValue: string | null,
): SemanticInferenceResult {
  if (parentDeclaratorId) {
    return { semanticName: parentDeclaratorId, inferenceSource: "variable" };
  }

  if (firstArgStringValue && firstArgStringValue.length > 0 && firstArgStringValue.length <= 64) {
    return { semanticName: sanitizeSemanticName(firstArgStringValue), inferenceSource: "string-literal" };
  }

  return { semanticName: null, inferenceSource: "hash" };
}

function sanitizeSemanticName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}