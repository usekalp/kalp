/**
 * Scaffold utilities for Kalp projects and agents.
 *
 * @module
 */

export {
  scaffoldProject,
  type ScaffoldProjectOptions,
} from "./project";
export { scaffoldAgent, type ScaffoldAgentOptions } from "./agent";
export {
  formatGeneratedFile,
  replacePlaceholders,
  ensureDir,
  writeFileIfNotExists,
} from "./utils";
