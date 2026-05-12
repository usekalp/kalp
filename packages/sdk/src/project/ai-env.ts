import type { AIProvider } from "@/primitives/ai";

declare global {
  interface KalpAIEnvironment {
    provider?: AIProvider;
    customModels?: readonly string[];
  }
}

export {};
