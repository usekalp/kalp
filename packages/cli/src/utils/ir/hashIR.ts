import type { IRGraph } from "@kalphq/sdk";
import { createHash } from "crypto";
import stableStringify from "json-stable-stringify";
import type { HandlerMap } from "@/utils/manifest/handlers";

export function getIRHash(ir: IRGraph): string {
  return createHash("sha256")
    .update(stableStringify(ir) ?? JSON.stringify(ir))
    .digest("hex");
}

export function computePushHash(ir: IRGraph, handlers: HandlerMap): string {
  const sortedHandlerHashes = Object.keys(handlers)
    .sort()
    .map((k) => handlers[k]!.hash)
    .join("|");
  const bundleHash = createHash("sha256")
    .update(sortedHandlerHashes)
    .digest("hex");
  const payload =
    stableStringify({ ir, bundleHash }) ?? JSON.stringify({ ir, bundleHash });
  return createHash("sha256").update(payload).digest("hex");
}
