/**
 * Scaffold utilities for Kalp projects and agents.
 *
 * @module
 */

export { scaffoldProject, type ScaffoldProjectOptions } from "./project";
export {
  formatGeneratedFile,
  replacePlaceholders,
  ensureDir,
  writeFileIfNotExists,
} from "./utils";
