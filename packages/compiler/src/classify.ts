import type { ClassifyIRNode, IRNodeId } from "@kalphq/sdk";
import { createIdGenerator } from "@/ids";

export interface ClassifyParams {
  input: string;
  labels: string[];
  model?: string;
  confidenceThreshold?: number;
  branches?: Array<{ label: string; next: IRNodeId }>;
  fallback?: IRNodeId;
  id?: IRNodeId;
}

export const compileClassify = (params: ClassifyParams): ClassifyIRNode => {
  const createId = createIdGenerator();
  return {
    kind: "llm.classify",
    id: params.id ?? createId("llm_classify"),
    model: params.model,
    input: { text: params.input, labels: params.labels },
    branches: params.branches ?? [],
    fallback: params.fallback,
    confidenceThreshold: params.confidenceThreshold,
  };
};
