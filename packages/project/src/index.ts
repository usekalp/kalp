export { scaffoldProject, type ScaffoldProjectOptions } from "./scaffold";

// Scaffold agent now comes from templates
export { scaffoldAgent, type ScaffoldAgentOptions } from "./templates/scaffold";
export { installDeps, ensureDirectory } from "./fs";

// Template system
export {
  TEMPLATES,
  getTemplate,
  type TemplateId,
  type TemplateDefinition,
} from "./templates";
