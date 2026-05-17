export class RuntimeError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "RuntimeError";
  }
}

export class RuntimeStateError extends RuntimeError {
  constructor(from: string, to: string) {
    super(`Invalid runtime state transition: ${from} → ${to}`, "STATE_ERROR");
    this.name = "RuntimeStateError";
  }
}

export class HotReloadError extends RuntimeError {
  constructor(message: string, cause?: Error) {
    super(message, "HOT_RELOAD_ERROR");
    this.name = "HotReloadError";
    this.cause = cause;
  }
}

export class ModuleLoadError extends RuntimeError {
  constructor(nodeId: string, cause?: Error) {
    super(`Failed to load module "${nodeId}"`, "MODULE_LOAD_ERROR");
    this.name = "ModuleLoadError";
    this.cause = cause;
  }
}

export class RestartTimeoutError extends RuntimeError {
  constructor(timeoutMs: number) {
    super(`Restart timed out after ${timeoutMs}ms`, "RESTART_TIMEOUT");
    this.name = "RestartTimeoutError";
  }
}

export class DeploymentNotFoundError extends RuntimeError {
  constructor(agentName: string) {
    super(`No deployment found for agent "${agentName}"`, "DEPLOYMENT_NOT_FOUND");
    this.name = "DeploymentNotFoundError";
  }
}
