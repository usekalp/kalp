export const PRIMITIVE_CATALOG: Record<string, string[]> = {
  ai: ["generate", "stream", "classify"],
  cache: ["get", "set", "delete"],
  memory: ["list", "append", "summarize"],
  log: ["info", "warn", "error", "debug"],
  vault: ["get"],
  time: ["now", "toISOString", "isAfter", "isBefore", "add", "sub", "timezone"],
  math: [
    "random",
    "floor",
    "ceil",
    "round",
    "min",
    "max",
    "abs",
    "pow",
    "sqrt",
  ],
  actions: [
    "run",
    "call",
    "dispatch",
    "ask",
    "requestApproval",
    "sleep",
    "waitUntil",
    "schedule",
    "loop",
    "fetch",
    "callAgent",
  ],
  schedules: ["cancel", "reschedule", "status"],
  history: ["list"],
  auth: ["getToken"],
  mcp: ["*"],
};

export function isKnownPrimitive(namespace: string, method: string): boolean {
  const methods = PRIMITIVE_CATALOG[namespace];
  if (!methods) return false;
  if (methods.includes("*")) return true;
  return methods.includes(method);
}

export function getAllPrimitiveTypes(): string[] {
  const types: string[] = [];
  for (const [ns, methods] of Object.entries(PRIMITIVE_CATALOG)) {
    if (methods.includes("*")) {
      types.push(ns);
      continue;
    }
    for (const method of methods) {
      types.push(`${ns}.${method}`);
    }
  }
  return types;
}
