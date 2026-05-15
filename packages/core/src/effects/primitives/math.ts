import type { KalpMath } from "@kalphq/sdk";
import type { SyncInterceptor } from "./types";

export function createMathContext(interceptSync: SyncInterceptor): KalpMath {
  return {
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    max: Math.max,
    min: Math.min,
    pow: Math.pow,
    round: Math.round,
    sqrt: Math.sqrt,
    random: () => interceptSync("math.random", {}, () => Math.random()),
  };
}
