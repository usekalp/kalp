export { compileAgent } from "@/compiler";
export { compileClassify } from "@/classify";
export { compileLoop } from "@/loop";
export type { LoopCompileResult } from "@/loop";
export { normalizeGraph } from "@/normalize";
export { toHandlerKey } from "@/handler-key";
export { recordHandler, adaptRouteHandler } from "@/record-handler";
export type {
  ExecutionTrace,
  LinearTrace,
  BranchingTrace,
  LoopCapture,
} from "@/record-handler";
export { traceToIR } from "@/trace-to-ir";
export type { IRFragment } from "@/trace-to-ir";
export {
  recordEmissions,
  recordWithBranching,
  createRecordingContext,
  CompileError,
} from "@/proxy";
export type {
  RecordingTrace,
  BranchingResult,
  ClassifyCapture,
  Event,
  SourceContext,
} from "@/proxy";
export * from "@/ir";
export {
  validateIR,
  validateIRBindings,
  IRGraphSchema,
  IRNodeSchema,
  IREdgeSchema,
} from "@/validate";
export type { ValidationResult, Severity, ValidationIssue } from "@/validate";
export { analyzeHandler } from "@/analyze";
export type { HandlerAnalysis } from "@/analyze";
export {
  computeScopes,
  computeSequence,
  findCycles,
  hasControlPath,
} from "@/graph";
