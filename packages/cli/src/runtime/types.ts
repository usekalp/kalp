export type RuntimeState = "idle" | "starting" | "running" | "restarting" | "stopping" | "stopped";

export type RestartReason =
  | "metadata-change"
  | "code-change"
  | "env-change"
  | "runtime-template-change"
  | "manual"
  | "startup";

export type RuntimeFileEventType = "add" | "change" | "unlink";

export interface RuntimeFileEvent {
  path: string;
  type: RuntimeFileEventType;
  timestamp: number;
}

export interface ReloadPlan {
  swaps: Array<{ agentName: string; reason: RestartReason }>;
  restartRequired: boolean;
  restartReason: RestartReason | null;
  rematerialize: boolean;
}

export const validTransitions: Record<RuntimeState, RuntimeState[]> = {
  idle: ["starting", "stopped"],
  starting: ["running", "stopping"],
  running: ["restarting", "stopping"],
  restarting: ["running", "stopping"],
  stopping: ["stopped"],
  stopped: ["idle"],
};
