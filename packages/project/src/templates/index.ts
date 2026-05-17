/**
 * Template system for agent scaffolding.
 *
 * Provides example templates for the vNext Kalp mental model:
 * - Researcher: hooks + cron + tools
 * - Support: contracts + local listeners
 * - Blank: minimal declarative agent
 * - Ops Revenue: contracts + tools + listeners orchestration
 *
 * @module
 */

export type { TemplateId, TemplateDefinition } from "./types";

import { researcherTemplate } from "./researcher";
import { supportTemplate } from "./support";
import { blankTemplate } from "./blank";
import { opsRevenueTemplate } from "./ops-revenue";
import type { TemplateId, TemplateDefinition } from "./types";

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  researcher: researcherTemplate,
  support: supportTemplate,
  blank: blankTemplate,
  "ops-revenue": opsRevenueTemplate,
};

export function getTemplate(id: TemplateId): TemplateDefinition | undefined {
  return TEMPLATES[id];
}
