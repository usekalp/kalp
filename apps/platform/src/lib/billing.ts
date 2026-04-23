export interface BillingEvent {
  unit: string;
  agentId: string;
  estimatedCost: number;
}

interface IRGraphLike {
  nodes: Record<string, unknown>;
}

export const billing = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  consume(_event: BillingEvent): boolean {
    return true;
  },
};

export function estimateFromIR(ir: IRGraphLike): number {
  return Object.keys(ir.nodes).length;
}
