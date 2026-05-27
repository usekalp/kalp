export interface PrimitiveCallSite {
  namespace: string;
  method: string;
  primitiveType: string;
  line: number;
  column: number;
  semanticName: string | null;
  inferenceSource: "variable" | "string-literal" | "hash";
  primitiveId: string;
  argPreview: {
    argsCount: number;
    firstArgType?: string;
  };
}

export interface HandlerSourceAnalysis {
  filePath: string;
  relativePath: string;
  exportName: string;
  stableName: string;
  nodeId: string;
  handlerLine: number;
  handlerColumn: number;
  primitives: PrimitiveCallSite[];
}

export interface SourceMetadataManifest {
  schemaVersion: 1;
  primitiveLocations: Record<string, SourceLocationEntry>;
  handlerLocations: Record<string, HandlerLocationEntry>;
}

export interface SourceLocationEntry {
  file: string;
  line: number;
  column: number;
  handlerId: string;
  primitiveType: string;
}

export interface HandlerLocationEntry {
  file: string;
  line: number;
  column: number;
  exportName: string;
  stableName: string;
  nodeId: string;
}

export interface NormalizedCallShape {
  callee: string;
  args: Array<{
    type: string;
    value?: string;
    keys?: string[];
  }>;
}

export interface PrimitiveDetection {
  namespace: string;
  method: string;
  primitiveType: string;
  line: number;
  column: number;
  argPreview: {
    argsCount: number;
    firstArgType?: string;
  };
  callExprSpan: { start: number; end: number };
  parentSpan: { start: number; end: number } | null;
  parentType: string;
  parentDeclaratorId: string | null;
  firstArgType: string | null;
  firstArgStringValue: string | null;
}

export interface SemanticInferenceResult {
  semanticName: string | null;
  inferenceSource: "variable" | "string-literal" | "hash";
}