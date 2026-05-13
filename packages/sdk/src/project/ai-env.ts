/**
 * Module-augmentable AI typing context.
 *
 * Projects augment this interface from `kalp.d.ts` so SDK primitives can infer
 * the configured provider and custom model suggestions.
 */
export interface KalpAIEnvironment {
  provider?: "openai" | "anthropic" | "openrouter" | "custom";
  customModels?: readonly string[];
}
