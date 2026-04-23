export { compileAgent } from "@/compiler";
export { compileClassify } from "@/classify";
export { compileLoop } from "@/loop";
export { normalizeGraph } from "@/normalize";
export { recordEmissions, recordWithBranching, CompileError } from "@/proxy";
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
