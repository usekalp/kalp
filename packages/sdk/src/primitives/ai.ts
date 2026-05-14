import type { z } from "zod";
import type { KalpAIEnvironment } from "@/project/ai-env";

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

export type AIProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "cloudflare"
  | "vercel"
  | "custom";

export type ProviderModelMap = {
  openai:
    | "gpt-5.5"
    | "gpt-5.5-pro"
    | "gpt-5.4"
    | "gpt-5.4-pro"
    | "gpt-5.4-mini"
    | "gpt-5.4-nano"
    | "gpt-5-mini"
    | "gpt-5-nano"
    | "gpt-5"
    | "gpt-5.3-codex"
    | "gpt-5.2-codex"
    | "gpt-5.2"
    | "gpt-5.1"
    | "gpt-5.2-pro"
    | "gpt-5-pro"
    | "gpt-4.1"
    | "gpt-4.1-mini"
    | "o3-deep-research"
    | "o3-pro"
    | "o3"
    | "o3-mini"
    | "o4-mini"
    | "o1-pro"
    | "o1"
    | "o1-mini"
    | "o1-preview"
    | "gpt-4o"
    | "gpt-4o-mini"
    | "gpt-4-turbo"
    | "gpt-3.5-turbo"
    | "gpt-4"
    | "gpt-oss-120b"
    | "gpt-oss-20b";
  anthropic:
    | "claude-opus-4.7"
    | "claude-opus-4.6"
    | "claude-opus-4.5"
    | "claude-opus-4.1"
    | "claude-opus-4"
    | "claude-opus-3"
    | "claude-sonnet-4.6"
    | "claude-sonnet-4.5"
    | "claude-sonnet-4"
    | "claude-sonnet-3.7"
    | "claude-haiku-4.5"
    | "claude-haiku-3.5";
  openrouter:
    | "openai/gpt-4o"
    | "openai/gpt-4o-mini"
    | "anthropic/claude-3.5-sonnet"
    | "anthropic/claude-3-opus"
    | (string & {});
  cloudflare: string & {};
  vercel: string & {};
  custom: string & {};
};

type ConfiguredProvider = KalpAIEnvironment extends { provider: infer P }
  ? P extends AIProvider
    ? P
    : AIProvider
  : AIProvider;

type ConfiguredCustomModels = KalpAIEnvironment extends {
  customModels: infer M;
}
  ? M extends readonly string[]
    ? M[number]
    : never
  : never;

export type ProviderName = AIProvider;

export type ConfiguredModel = ConfiguredProvider extends infer P
  ? P extends "openai"
    ? ProviderModelMap["openai"]
    : P extends "anthropic"
      ? ProviderModelMap["anthropic"]
      : P extends "openrouter"
        ? ProviderModelMap["openrouter"]
        : P extends "cloudflare"
          ? string & {}
          : P extends "vercel"
            ? string & {}
            : P extends "custom"
              ? ConfiguredCustomModels | (string & {})
              : (string & {})
  : never;

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
