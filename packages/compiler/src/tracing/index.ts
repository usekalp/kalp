export type {
  PrimitiveCallSite,
  HandlerSourceAnalysis,
  SourceMetadataManifest,
  SourceLocationEntry,
  HandlerLocationEntry,
  NormalizedCallShape,
  PrimitiveDetection,
  SemanticInferenceResult,
} from "./types";
export {
  PRIMITIVE_CATALOG,
  isKnownPrimitive,
  getAllPrimitiveTypes,
} from "./primitive-catalog";
export {
  spanToLocation,
  findExportPosition,
  findHandlerBodyOffset,
} from "./source-locations";
export { detectPrimitives } from "./primitive-detector";
export { inferSemanticName } from "./semantic-inference";
export { normalizeCallForHash, stableHashNormalized } from "./ast-normalizer";
export { sanitizeStableSegment, generatePrimitiveId } from "./primitive-id";
export { buildManifest, writeManifest } from "./source-metadata";
export { analyzeHandlerSource, analyzeHandlerFile } from "./handler-analysis";
