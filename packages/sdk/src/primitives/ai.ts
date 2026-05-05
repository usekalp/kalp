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

export type ModelMap = {
  openai:
    | "gpt-5.4"
    | "gpt-5.4-nano"
    | "gpt-5-mini"
    | "gpt-5.1-thinking"
    | "gpt-4o"
    | "gpt-4o-mini"
    | "gpt-4-turbo"
    | "gpt-4"
    | "gpt-3.5-turbo";

  anthropic:
    | "claude-opus-4.7"
    | "claude-opus-4.6"
    | "claude-sonnet-4.6"
    | "claude-sonnet-4.5"
    | "claude-haiku-4.5";

  google:
    | "gemini-3-flash"
    | "gemini-3.1-pro-preview"
    | "gemini-3.1-flash-lite-preview"
    | "gemini-2.5-flash"
    | "gemini-1.5-pro"
    | "gemini-1.5-flash"
    | "gemini-1.0-pro";

  groq:
    | "llama-3-70b-8192"
    | "llama-3-8b-8192"
    | "mixtral-8x7b-32768"
    | "gemma-7b-it"
    | "grok-4.1-fast-non-reasoning";

  mistral:
    | "mistral-large-latest"
    | "mistral-medium-latest"
    | "mistral-small-latest";

  perplexity: "llama-3-sonar-large-32k-online" | "llama-3-sonar-small-32k-chat";

  moonshot: "kimi-k2.5";

  openai_other: "gpt-oss-120b" | "gpt-5.3-codex";

  voyage: "voyage-4-lite";
};

export type ProviderName = keyof ModelMap;
export type LocalModelId = `local/${string}`;

export type KalpModelId =
  | {
      [P in ProviderName]: `${P}/${ModelMap[P]}`;
    }[ProviderName]
  | LocalModelId;

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
   * Model in `provider/model` format. Example: `openai/gpt-4o`.
   */
  model: KalpModelId;
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
  generate: <T extends z.ZodTypeAny = never>(
    params: AIParams & { schema?: T },
  ) => Promise<T extends z.ZodTypeAny ? z.infer<T> : string>;

  /**
   * Streams a response from an LLM.
   * Returns an async iterator of tokens.
   *
   * @param params - The generation parameters.
   * @returns Async iterable of tokens or partial objects.
   */
  stream: <T extends z.ZodTypeAny = never>(
    params: AIParams & { schema?: T },
  ) => T extends z.ZodTypeAny
    ? AsyncIterable<Partial<z.infer<T>>>
    : AsyncIterable<string>;

  /**
   * Classifies text into one of the provided labels.
   *
   * @param params - Classification parameters including input text and labels.
   * @returns The selected label.
   */
  classify: (params: {
    input: string;
    labels: string[];
    model?: KalpModelId;
    confidenceThreshold?: number;
  }) => Promise<string>;
}
