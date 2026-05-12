/**
 * Template system for agent scaffolding.
 *
 * Provides three templates that showcase Kalp's unique features:
 * - Researcher: Deterministic time scheduling with waitUntil
 * - Support: Human-in-the-Loop with waitForEvent
 * - Blank: Modern syntax with autodiscovery
 *
 * @module
 */

export type { TemplateId, TemplateDefinition } from "./types";

import { researcherTemplate } from "./researcher";
import { supportTemplate } from "./support";
import { blankTemplate } from "./blank";
import { opsRevenueTemplate } from "./ops-revenue";
import type { TemplateId, TemplateDefinition } from "./types";

/**
 * Registry of all available templates.
 */
export const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  researcher: researcherTemplate,
  support: supportTemplate,
  blank: blankTemplate,
  "ops-revenue": opsRevenueTemplate,
};

/**
 * Get a template by ID.
 * @param id - Template identifier
 * @returns Template definition or undefined if not found
 */
export function getTemplate(id: TemplateId): TemplateDefinition | undefined {
  return TEMPLATES[id];
}
