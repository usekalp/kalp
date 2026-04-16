import { createSignal } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Signal sent when a deal is won for commission tracking
 */
export const dealWon = createSignal({
  id: "deal_won",
  input: z.object({
    customerId: z.string(),
    leadId: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string(),
    source: z.string(),
    repId: z.string().optional(),
  }),
  async handler({ customerId, leadId, amount, currency, source, repId }) {
    // Signal received - in real implementation this would:
    // - Update CRM with deal status
    // - Notify sales manager
    // - Track commission for rep
    return {
      recorded: true,
      dealId: leadId ?? customerId,
      amount,
      currency,
      source,
      commissionRep: repId,
    };
  },
});
