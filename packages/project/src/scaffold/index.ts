/**
 * Scaffold utilities for Kalp projects and agents.
 *
 * @module
 */

export {
  scaffoldProject,
  type ScaffoldProjectOptions,
} from "@/scaffold/project";
export { scaffoldAgent, type ScaffoldAgentOptions } from "@/scaffold/agent";
export {
  formatGeneratedFile,
  replacePlaceholders,
  ensureDir,
  writeFileIfNotExists,
} from "@/scaffold/utils";
