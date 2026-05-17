export interface AgentUpdatedEvent {
  type: "agent_updated";
  agentName: string;
  deploymentHash: string;
  generation: number;
  changeType: "metadata" | "code";
  timestamp: string;
}

export interface ExecutionStartedEvent {
  type: "execution_started";
  agentName: string;
  executionId: string;
  deploymentHash: string;
  timestamp: string;
}

export interface ExecutionCompletedEvent {
  type: "execution_completed";
  agentName: string;
  executionId: string;
  deploymentHash: string;
  status: "success" | "error";
  duration: number;
  timestamp: string;
}

export interface StatePatchedEvent {
  type: "state_patched";
  agentName: string;
  executionId: string;
  patch: unknown;
  timestamp: string;
}

export interface NodeStartedEvent {
  type: "node_started";
  agentName: string;
  executionId: string;
  nodeId: string;
  stableName: string;
  timestamp: string;
}

export interface NodeCompletedEvent {
  type: "node_completed";
  agentName: string;
  executionId: string;
  nodeId: string;
  stableName: string;
  status: "success" | "error";
  duration: number;
  timestamp: string;
}

export type RuntimeEvent =
  | AgentUpdatedEvent
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | StatePatchedEvent
  | NodeStartedEvent
  | NodeCompletedEvent;
