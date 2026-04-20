import type {
  AgentManifestV1,
  AgentStepItem,
  AgentItemWithInput,
  AgentRouteItem,
  AgentFlowItem,
} from "@/utils/manifest/types";
import {
  asRecord,
  asString,
  asArray,
  toJsonSchema,
} from "@/utils/manifest/types";

export function serializeSystemPrompt(
  systemPrompt: unknown,
): AgentManifestV1["agent"]["systemPrompt"] {
  if (typeof systemPrompt === "string") {
    return { type: "static", value: systemPrompt };
  }

  if (typeof systemPrompt === "function") {
    return { type: "dynamic" };
  }

  return { type: "none" };
}

export function serializeSteps(
  steps: unknown[],
): AgentManifestV1["agent"]["steps"] {
  return steps.map((step, index) => {
    const item = asRecord(step) as AgentStepItem;
    return {
      id: asString(item.id) ?? `step_${index + 1}`,
      order: index + 1,
      description: asString(item.description) ?? "",
      inputSchema: toJsonSchema(item.input, `step_${index + 1}_input`),
      outputSchema: toJsonSchema(item.output, `step_${index + 1}_output`),
    };
  });
}

export function serializeTools(
  tools: unknown[],
): AgentManifestV1["agent"]["tools"] {
  return tools.map((tool, index) => {
    const item = asRecord(tool) as AgentItemWithInput;
    return {
      id: asString(item.id) ?? `tool_${index + 1}`,
      order: index + 1,
      description: asString(item.description) ?? "",
      inputSchema: toJsonSchema(item.input, `tool_${index + 1}_input`),
    };
  });
}

export function serializeRoutes(
  routes: unknown[],
): AgentManifestV1["agent"]["routes"] {
  return routes.map((route, index) => {
    const item = asRecord(route) as AgentRouteItem;
    return {
      id: asString(item.id) ?? `route_${index + 1}`,
      order: index + 1,
      method: asString(item.method) ?? "GET",
      path: asString(item.path) ?? "/",
      inputSchema: toJsonSchema(item.input, `route_${index + 1}_input`),
    };
  });
}

export function serializeFlows(
  flows: unknown[],
  stepIds: Set<string>,
): AgentManifestV1["agent"]["flows"] {
  return flows.map((flow, index) => {
    const item = asRecord(flow) as AgentFlowItem;
    const steps = asArray(item.steps).map((s, stepIndex) => {
      const step = asRecord(s);
      const stepId = asString(step.id) ?? `step_${stepIndex + 1}`;
      return {
        order: stepIndex + 1,
        stepId,
        existsInAgentSteps: stepIds.has(stepId),
      };
    });

    return {
      id: asString(item.id) ?? `flow_${index + 1}`,
      order: index + 1,
      description: asString(item.description) ?? "",
      steps,
    };
  });
}
