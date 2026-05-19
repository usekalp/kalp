import type {
  BundleManifest,
  BundleNodeBinding,
  IRGraph,
  KalpHistory,
  KalpHistoryMessage,
} from "@kalphq/sdk";
import type { RuntimeEvent } from "@/engine/types";
import type { PersistenceAdapter } from "@/adapters/interfaces";
import type { EffectResolver } from "@/effects/types";
import { ReplayLog } from "../state/replay-log";
import { SuspensionException } from "@/engine/suspension";
import type { ExecutionFrame } from "../execution/frame";
import { resolveBundleBinding } from "./bundle-resolver";
import { loadHistory } from "./history-loader";
import { loadHandlerModule } from "./module-loader";
import { createLocalActions } from "./local-actions";
import { buildHandlerContext } from "./context-factory";

export interface ExecutionResult {
  value?: unknown;
  suspended?: boolean;
  until?: number;
  wakeReason?: string;
}

export type RuntimeBundleLoader = (
  binding: BundleNodeBinding,
  nodeId: string,
) => Promise<string>;

export function resolveSystemPrompt(ir: IRGraph): string {
  const prompt = ir.agent?.systemPrompt;
  if (typeof prompt === "object" && prompt !== null && "dynamic" in prompt) {
    return "";
  }
  return prompt ?? "";
}

export async function executeHandlerBundle(
  nodeId: string,
  event: RuntimeEvent,
  frame: ExecutionFrame,
  log: ReplayLog,
  persistence: PersistenceAdapter,
  resolver: EffectResolver,
  ir: IRGraph,
  _schemas: Record<string, unknown>,
  bundleManifest: BundleManifest,
  bundleLoader: RuntimeBundleLoader,
  state: Record<string, unknown>,
  historyEntries?: KalpHistoryMessage[],
): Promise<ExecutionResult> {
  const binding = resolveBundleBinding(nodeId, bundleManifest);
  if (!binding) {
    throw new Error(`Execution failed: bundle binding missing for node ${nodeId}.`);
  }

  const historyMessages = historyEntries ?? (await loadHistory(frame.ctx.threadId, persistence));
  const history: KalpHistory = { list: () => Promise.resolve(historyMessages) };

  const localActions = createLocalActions(
    frame, ir, persistence, log, resolver, _schemas,
    bundleManifest, bundleLoader, state, historyMessages,
  );

  const ctx = buildHandlerContext(resolver, log, frame, history, persistence, ir, state, localActions);
  const fn = await loadHandlerModule(binding, nodeId, bundleLoader);

  const isContextOnly =
    event.type === "onInit" ||
    event.type === "onTick" ||
    event.type.startsWith("schedule:");

  try {
    const value = isContextOnly
      ? await fn(undefined, ctx)
      : await fn(event.payload, ctx);
    return { value };
  } catch (err: unknown) {
    if (err instanceof SuspensionException) {
      await persistence.events.append({
        type: "execution.suspended",
        nodeId,
        resumeAt: err.resumeAt,
        executionId: frame.executionId,
        traceId: frame.ctx.traceId,
        threadId: frame.ctx.threadId,
        timestamp: Date.now(),
      });

      return {
        suspended: true,
        until: err.resumeAt,
        wakeReason: err.wakeReason,
      };
    }
    throw err;
  }
}
