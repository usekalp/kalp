/**
 * Template system types for agent scaffolding.
 *
 * @module
 */

/**
 * Available template identifiers.
 */
export type TemplateId = "researcher" | "support" | "blank" | "ops-revenue";

/**
 * Template definition with metadata and generation function.
 */
export interface TemplateDefinition {
  /** Template identifier */
  id: TemplateId;
  /** Display name for the template */
  name: string;
  /** Brief description of what the template demonstrates */
  description: string;
  /** Emoji/icon for visual identification */
  icon: string;
  /** Generate the template files */
  generate: (opts: { agentName: string; cwd: string; label?: string }) => Promise<void>;
}
