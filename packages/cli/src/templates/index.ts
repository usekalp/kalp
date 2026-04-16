export type TemplateId =
  | "customer-support"
  | "b2b-sales"
  | "financial-agent"
  | "minimal";

export interface TemplateMeta {
  id: TemplateId;
  label: string;
  hint: string;
  secrets: string[];
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "customer-support",
    label: "Customer Support",
    hint: "ticket routing, escalation, knowledge base",
    secrets: ["OPENAI_API_KEY"],
  },
  {
    id: "b2b-sales",
    label: "B2B Sales Outreach",
    hint: "CRM enrichment, lead scoring",
    secrets: ["OPENAI_API_KEY", "CRM_API_KEY"],
  },
  {
    id: "financial-agent",
    label: "Financial Agent",
    hint: "market signals, portfolio analysis",
    secrets: ["OPENAI_API_KEY", "MARKET_DATA_API_KEY"],
  },
  {
    id: "minimal",
    label: "Minimal Skeleton",
    hint: "bare structure, start from scratch",
    secrets: [],
  },
];

export function getTemplateMeta(id: TemplateId): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id)!;
}
