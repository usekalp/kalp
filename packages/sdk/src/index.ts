import { z } from "zod";
import type { Signal, Step, Tool, Webhook } from "@/types";

// ─── Step Factory ─────────────────────────────────────────────────────────────

/**
 * Creates a typed {@link Step} and attaches the `"step"` kind discriminant.
 *
 * @typeParam I           - Zod schema for the step's input.
 * @typeParam O           - Zod schema for the step's output.
 * @typeParam TUserSchema - The agent's database schema (forwarded to `ctx`).
 *
 * @example
 * ```ts
 * export const verifyUser = createStep({
 *   id: "verify_user",
 *   input: z.object({ email: z.string().email() }),
 *   output: z.object({ active: z.boolean(), tier: z.string() }),
 *   run: async ({ email }, ctx) => {
 *     ctx.logger.info("Verifying user", { email });
 *     return { active: true, tier: "pro" };
 *   },
 * });
 * ```
 */
export const createStep = <
  I extends z.ZodTypeAny,
  O extends z.ZodTypeAny,
  TUserSchema extends object = object,
>(
  config: Omit<Step<I, O, TUserSchema>, "kind">,
): Step<I, O, TUserSchema> => ({ ...config, kind: "step" });

// ─── Tool Factory ─────────────────────────────────────────────────────────────

/**
 * Creates a typed {@link Tool} and attaches the `"tool"` kind discriminant.
 *
 * @typeParam I           - Zod schema for the tool's input.
 * @typeParam R           - The tool's return type.
 * @typeParam TUserSchema - The agent's database schema (forwarded to `ctx`).
 *
 * @example
 * ```ts
 * export const searchKnowledgeBase = createTool({
 *   id: "search_kb",
 *   description: "Searches the product knowledge base.",
 *   input: z.object({ query: z.string() }),
 *   execute: async ({ query }, ctx) => {
 *     return ctx.db.all<KBEntry>("SELECT * FROM kb WHERE content LIKE ?", [`%${query}%`]);
 *   },
 * });
 * ```
 */
export const createTool = <
  I extends z.ZodTypeAny,
  R = unknown,
  TUserSchema extends object = object,
>(
  config: Omit<Tool<I, R, TUserSchema>, "kind">,
): Tool<I, R, TUserSchema> => ({ ...config, kind: "tool" });

// ─── Signal Factory ───────────────────────────────────────────────────────────

/**
 * Creates a typed {@link Signal} for inter-agent communication.
 * The engine validates the incoming payload against the Zod schema before
 * invoking the handler, ensuring type safety across agent boundaries.
 *
 * @example
 * ```ts
 * export const onDealClosed = createSignal({
 *   id: "deal_closed",
 *   input: z.object({ dealId: z.string(), amount: z.number() }),
 *   handler: async ({ dealId, amount }, ctx) => {
 *     ctx.logger.info("Deal closed", { dealId, amount });
 *   },
 * });
 * ```
 */
export const createSignal = <I extends z.ZodTypeAny, R = void>(
  config: Signal<I, R>,
): Signal<I, R> => config;

// ─── Webhook Factory ──────────────────────────────────────────────────────────

/**
 * Creates a typed {@link Webhook} handler with Zod-validated input.
 *
 * @example
 * ```ts
 * export const onboarding = defineWebhook({
 *   id: "onboarding",
 *   input: z.object({ userId: z.string(), email: z.string().email() }),
 *   handler: async ({ userId, email }) => {
 *     return { success: true, userId };
 *   },
 * });
 * ```
 */
export const defineWebhook = <I extends z.ZodTypeAny, R = unknown>(
  config: Webhook<I, R>,
): Webhook<I, R> => config;

// ─── Project Config ───────────────────────────────────────────────────────────

/** Top-level Kalp project configuration, defined in `kalp.config.ts`. */
export interface KalpConfig {
  projectId: string;
  region?: string;
  secrets?: string[];
}

/**
 * Defines the Kalp project configuration with type checking.
 * Place this in your `kalp.config.ts` at the project root.
 */
export function defineConfig(config: KalpConfig): KalpConfig {
  return config;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export * from "@/types";
export * from "@/agent";
