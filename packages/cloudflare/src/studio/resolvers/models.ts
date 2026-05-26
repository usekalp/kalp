export function normalizeTags(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function normalizeNodeCollection(
  semanticIr: Record<string, unknown> | null | undefined,
): Record<string, unknown>[] {
  return Object.values(semanticIr?.nodes ?? {}).filter(
    (node): node is Record<string, unknown> =>
      node != null &&
      typeof node === "object" &&
      typeof (node as Record<string, unknown>).id === "string",
  );
}

export function normalizeStableName(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function routeModel(node: Record<string, unknown>) {
  return {
    id: node.id,
    stableName: normalizeStableName(node.stableName),
    name: typeof node.name === "string" ? node.name : undefined,
    method:
      (node.http as Record<string, unknown>)?.method ??
      (node.trigger as Record<string, unknown>)?.method ??
      "GET",
    path:
      (node.http as Record<string, unknown>)?.path ??
      (node.trigger as Record<string, unknown>)?.path ??
      "/",
    public: Boolean((node.http as Record<string, unknown>)?.skipAuth),
  };
}

export function contractModel(node: Record<string, unknown>) {
  return {
    id: node.id,
    stableName: normalizeStableName(node.stableName),
    name:
      typeof node.name === "string"
        ? node.name
        : (node.trigger as Record<string, unknown>)?.contractName,
  };
}

export function listenerModel(node: Record<string, unknown>) {
  return {
    id: node.id,
    stableName: normalizeStableName(node.stableName),
    event:
      (node.listener as Record<string, unknown>)?.event ??
      (node.trigger as Record<string, unknown>)?.event ??
      node.name ??
      "listener",
    name: typeof node.name === "string" ? node.name : undefined,
  };
}

export function triggerModel(node: Record<string, unknown>) {
  if (node.kind === "cron") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      type: "schedule",
      expression: (node.schedule as Record<string, unknown>)?.expression ?? "",
      timezone: (node.schedule as Record<string, unknown>)?.timezone ?? "UTC",
    };
  }
  if (node.kind === "listener") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      type: "listener",
      event:
        (node.listener as Record<string, unknown>)?.event ??
        (node.trigger as Record<string, unknown>)?.event ??
        node.name ??
        "listener",
    };
  }
  if (node.kind === "message" || node.kind === "init" || node.kind === "tick") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      type: "hook",
      event: node.kind,
    };
  }
  return null;
}

export function entrypointModel(node: Record<string, unknown>) {
  if (node.kind === "route") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      kind: "route",
      title:
        typeof node.name === "string"
          ? node.name
          : ((node.http as Record<string, unknown>)?.path ?? node.id),
      method:
        (node.http as Record<string, unknown>)?.method ??
        (node.trigger as Record<string, unknown>)?.method ??
        "GET",
      path:
        (node.http as Record<string, unknown>)?.path ??
        (node.trigger as Record<string, unknown>)?.path ??
        "/",
    };
  }
  if (node.kind === "contract") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      kind: "contract",
      title: typeof node.name === "string" ? node.name : node.id,
    };
  }
  if (node.kind === "listener") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      kind: "listener",
      title:
        (node.listener as Record<string, unknown>)?.event ??
        node.name ??
        node.id,
    };
  }
  if (node.kind === "message" || node.kind === "init" || node.kind === "tick") {
    return {
      id: node.id,
      stableName: normalizeStableName(node.stableName),
      kind: "hook",
      title: node.kind,
    };
  }
  return null;
}