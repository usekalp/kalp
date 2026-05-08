import type { IRGraph } from "@kalphq/sdk";
import { calculateAgentHash } from "@kalphq/compiler";
import type { HandlerMap } from "@/utils/manifest/handlers";

export function getIRHash(ir: IRGraph): string {
  // Delegate to compiler's calculateIRHash for consistency
  const { calculateIRHash } = require("@kalphq/compiler");
  return calculateIRHash(ir);
}

export function computePushHash(ir: IRGraph, handlers: HandlerMap): string {
  // Use unified hash function from compiler for consistency with Cloud
  return calculateAgentHash(ir, handlers);
}
