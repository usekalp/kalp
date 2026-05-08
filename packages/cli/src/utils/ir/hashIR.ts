import type { IRGraph } from "@kalphq/sdk";
import { calculateAgentHash } from "@kalphq/compiler";

export function getIRHash(ir: IRGraph): string {
  const { calculateIRHash } = require("@kalphq/compiler");
  return calculateIRHash(ir);
}

export function computePushHash(
  ir: IRGraph & { bundles?: Record<string, { code: string }> },
): string {
  const bundles = ir.bundles || {};
  const handlers = Object.keys(bundles).reduce(
    (acc, hash) => ({
      ...acc,
      [hash]: { hash },
    }),
    {} as Record<string, { hash: string }>,
  );

  return calculateAgentHash(ir, handlers);
}
