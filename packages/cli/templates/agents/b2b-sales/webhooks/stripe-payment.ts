import { defineWebhook } from "@kalphq/sdk";
import { z } from "zod";

/**
 * Stripe webhook for payment events - tracks trial conversions and payments
 */
export const stripePayment = defineWebhook({
  id: "stripe_payment",
  input: z.object({
    type: z.string(), // "payment_intent.succeeded", "invoice.paid", etc.
    customerId: z.string(),
    amount: z.number().optional(),
    currency: z.string().default("usd"),
    metadata: z.record(z.unknown()).optional(),
  }),
  async handler({ type, customerId, amount, currency }) {
    // Process Stripe payment event
    // In real implementation, this would update CRM and notify agents
    return {
      received: true,
      eventType: type,
      customerId,
      amount,
      currency,
    };
  },
});
