export { compileAgent } from "@/compiler";
export { compileClassify } from "@/classify";
export { compileLoop } from "@/loop";
export { normalizeGraph } from "@/normalize";
export { toHandlerKey } from "@/handler-key";
export { recordHandler } from "@/record-handler";
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
export type { RecordingTrace, BranchingResult, ClassifyCapture } from "@/proxy";
export * from "@/ir";
export {
  validateIR,
  validateIRBindings,
  IRGraphSchema,
  IRNodeSchema,
  IREdgeSchema,
} from "@/validate";
export type { ValidationResult } from "@/validate";
export { analyzeHandler } from "@/analyze";
export type { HandlerAnalysis } from "@/analyze";
