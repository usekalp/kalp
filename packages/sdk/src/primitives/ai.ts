import type { z } from "zod";

export interface KalpHistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export type KnownTier =
  | "low"
  | "high"
  | "reasoning"
  | "vision"
  | "moderation"
  | "extraction"
  | "classification"
  | "coding"
  | "longContext";

export interface KalpAITierRegistry {
  // Augment this in .kalp/generated/project.d.ts
}

type RegisteredAITiers = KalpAITierRegistry extends { keys: infer K }
  ? K extends readonly string[]
    ? K
    : readonly string[]
  : readonly string[];

type IsGenericStringArray<T> = T extends readonly string[]
  ? string extends T[number]
    ? true
    : false
  : false;

type TierKey<TTiers extends readonly string[]> =
  IsGenericStringArray<TTiers> extends true
    ? string & Record<never, never>
    : TTiers[number];

export type ModelTier = TierKey<RegisteredAITiers>;

export interface KalpAI {
  generate: <T extends z.ZodTypeAny | undefined = undefined>(
    params: {
      tier?: ModelTier;
      prompt: string;
      system?: string;
      schema?: T;
      temperature?: number;
      maxTokens?: number;
    },
  ) => Promise<T extends z.ZodTypeAny ? z.infer<T> : string>;

  stream: (
    params: {
      tier?: ModelTier;
      prompt: string;
      system?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ) => AsyncIterable<string>;

  classify: <T extends string>(
    params: {
      input: string;
      labels: readonly T[];
      tier?: ModelTier;
      confidenceThreshold?: number;
    },
  ) => Promise<T>;
}
