import type { IRGraph } from "@kalphq/sdk";
import type { EventDispatchEnvelope } from "./types";

export function isDispatchEnvelope(
  payload: unknown,
): payload is EventDispatchEnvelope {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return (
    typeof value.eventName === "string" &&
    typeof value.traceId === "string" &&
    typeof value.parentExecutionId === "string"
  );
}

export function resolveNodeId(
  eventType: string,
  ir: IRGraph,
): string | null {
  if (eventType === "onMessage") {
    return findNodeId(ir, (node) => node.kind === "message");
  }

  if (eventType === "onInit") {
    return findNodeId(ir, (node) => node.kind === "init");
  }

  if (eventType === "onTick") {
    return findNodeId(ir, (node) => node.kind === "tick");
  }

  if (eventType.startsWith("contract:")) {
    const contractName = eventType.slice("contract:".length);
    return findNodeId(
      ir,
      (node) => node.kind === "contract" && node.trigger?.type === "rpc" && node.trigger.contractName === contractName,
    );
  }

  if (eventType.startsWith("listener:")) {
    const eventName = eventType.slice("listener:".length);
    return findNodeId(
      ir,
      (node) => node.kind === "listener" && node.listener?.event === eventName,
    );
  }

  if (eventType.startsWith("route:")) {
    const routeKey = eventType.slice("route:".length);
    return findNodeId(
      ir,
      (node) =>
        node.kind === "route" &&
        Boolean(node.http && `${node.http.method}:${node.http.path}` === routeKey),
    );
  }

  if (eventType.startsWith("schedule:")) {
    const scheduleId = eventType.slice("schedule:".length);
    return findNodeId(
      ir,
      (node) =>
        node.kind === "cron" &&
        node.trigger?.type === "schedule" &&
        node.trigger.scheduleId === scheduleId,
    );
  }

  return ir.nodes[eventType]?.id ?? null;
}

export function resolveListenerNodeId(
  listener: { __runtimeId?: string; event?: string } | null | undefined,
  ir: IRGraph,
): string | null {
  const runtimeId = listener?.__runtimeId;
  if (runtimeId) {
    return resolveNodeId(runtimeId, ir);
  }

  if (listener?.event) {
    return findNodeId(
      ir,
      (node) => node.kind === "listener" && node.listener?.event === listener.event,
    );
  }

  return null;
}

function findNodeId(
  ir: IRGraph,
  predicate: (node: IRGraph["nodes"][string]) => boolean,
): string | null {
  for (const [nodeId, node] of Object.entries(ir.nodes)) {
    if (predicate(node)) {
      return nodeId;
    }
  }

  return null;
}
