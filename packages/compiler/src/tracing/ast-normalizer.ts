export interface NormalizedCallNode {
  type: string;
  callee: string;
  args: NormalizedArg[];
}

export interface NormalizedArg {
  type: string;
  value?: string;
  keys?: string[];
}

export function normalizeCallForHash(raw: {
  callee: string;
  args: Array<{ type: string; value?: string; keys?: string[] }>;
}): NormalizedCallNode {
  return {
    type: "call",
    callee: raw.callee,
    args: raw.args.map((arg) => {
      const normalized: NormalizedArg = { type: arg.type };
      if (arg.value !== undefined && arg.value.length <= 64) {
        normalized.value = arg.value;
      }
      if (arg.keys && arg.keys.length > 0) {
        normalized.keys = [...arg.keys].sort();
      }
      return normalized;
    }),
  };
}

export function stableHashNormalized(normalized: NormalizedCallNode): string {
  const json = JSON.stringify(normalized);
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash + json.charCodeAt(i)) & 0x7fffffff;
  }
  return hash.toString(36).padStart(6, "0");
}
