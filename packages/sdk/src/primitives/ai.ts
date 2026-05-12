import type { z } from "zod";

/**
 * Available AI providers and their model identifiers.
 *
 * @module
 */

/**
 * A message in the conversation history.
 */
export interface KalpHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export type AIProvider = "openai" | "anthropic" | "openrouter" | "custom";

export type ProviderModelMap = {
  openai: "gpt-4o" | "gpt-4o-mini" | "o1-preview" | "o1-mini";
  anthropic: "claude-3-5-sonnet-latest" | "claude-3-haiku-20240307";
  openrouter:
    | "openai/gpt-4o-mini"
    | "anthropic/claude-3.5-sonnet"
    | (string & {});
  custom: string & {};
};

type ConfiguredProvider = KalpAIEnvironment["provider"] extends AIProvider
  ? KalpAIEnvironment["provider"]
  : AIProvider;

type ConfiguredCustomModels = KalpAIEnvironment["customModels"] extends
  readonly string[]
  ? KalpAIEnvironment["customModels"][number]
  : never;

export type ProviderName = AIProvider;

export type ConfiguredModel = ConfiguredProvider extends "custom"
  ? ConfiguredCustomModels | ProviderModelMap["custom"]
  : ProviderModelMap[ConfiguredProvider];

export type KalpModelId = ConfiguredModel;

/**
 * Parameters for AI generation calls.
 */
export interface AIParams {
  /**
   * The user prompt/message. The runtime automatically manages conversation history.
   */
  prompt: string;
  /**
   * System instructions for the AI.
   */
  system?: string;
  /**
   * Model id compatible with the provider configured in kalp.config.ts.
   */
  model: ConfiguredModel;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

/**
 * AI primitive interface for LLM interactions.
 * All methods are declarative contracts - actual implementation is injected by the runtime.
 */
export interface KalpAI {
  /**
   * Generates a response from an LLM.
   * If a schema is provided, the response is validated and typed accordingly.
   *
   * @param params - The generation parameters including prompt and optional schema.
   * @returns The generated text or validated object.
   */
  generate: <T extends z.ZodTypeAny | undefined = undefined>(
    params: AIParams & { schema?: T },
  ) => Promise<T extends z.ZodTypeAny ? z.infer<T> : string>;

  /**
   * Streams a response from an LLM.
   * Returns an async iterator of tokens.
   *
   * @param params - The generation parameters.
   * @returns Async iterable of tokens or partial objects.
   */
  stream: <T extends z.ZodTypeAny | undefined = undefined>(
    params: AIParams & { schema?: T },
  ) => T extends z.ZodTypeAny
    ? AsyncIterable<Partial<z.infer<T>>>
    : AsyncIterable<string>;

  /**
   * Classifies text into one of the provided labels.
   *
   * @param params - Classification parameters including input text and labels.
   * @returns The selected label from the provided labels array.
   */
  classify: <T extends string>(params: {
    input: string;
    labels: readonly T[];
    model?: ConfiguredModel;
    confidenceThreshold?: number;
  }) => Promise<T>;
}
