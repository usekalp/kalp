import type { IRGraph } from "@kalphq/sdk";
import { createHash } from "crypto";

export function getIRHash(ir: IRGraph): string {
  return createHash("sha256")
    .update(JSON.stringify(ir))
    .digest("hex");
}
