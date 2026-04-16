import { createStep } from "@kalphq/sdk";
import { z } from "zod";

export const escalateTicket = createStep({
  id: "escalate_ticket",
  description: "Determines if a ticket should be escalated to human support.",
  input: z.object({
    category: z.string(), // "billing", "technical", "general"
    priority: z.string(), // "low", "medium", "high"
    sentiment: z.string(), // "frustrated", "angry", "neutral", "satisfied"
    previousAttempts: z.number().default(0),
  }),
  output: z.object({
    escalate: z.boolean(),
    reason: z.string(),
    assignTo: z.string(), // "tier1", "tier2", "tier3", "human"
  }),
  async run({ category, priority, sentiment, previousAttempts }) {
    // Auto-escalate frustrated/angry customers with technical issues
    if ((sentiment === "frustrated" || sentiment === "angry") && category === "technical") {
      return {
        escalate: true,
        reason: "Frustrated customer with technical issue",
        assignTo: "tier2",
      };
    }

    // Escalate high priority billing issues immediately
    if (priority === "high" && category === "billing") {
      return {
        escalate: true,
        reason: "High priority billing issue",
        assignTo: "tier3",
      };
    }

    // Escalate after multiple failed attempts
    if (previousAttempts >= 3) {
      return {
        escalate: true,
        reason: `Multiple failed resolution attempts (${previousAttempts})`,
        assignTo: "human",
      };
    }

    // No escalation needed
    return {
      escalate: false,
      reason: "Within agent capabilities",
      assignTo: "tier1",
    };
  },
});
