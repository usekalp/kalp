export { compileAgent } from "@/compiler";
export { compileClassify } from "@/classify";
export { compileLoop } from "@/loop";
export { normalizeGraph } from "@/normalize";
export { recordEmissions, recordWithBranching, CompileError } from "@/proxy";
export type { RecordingTrace, BranchingResult, ClassifyCapture } from "@/proxy";
export * from "@/ir";
