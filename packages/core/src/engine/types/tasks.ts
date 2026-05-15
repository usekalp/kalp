/**
 * Execution tasks - internal work items in the reactor queue.
 *
 * @module
 */

/**
 * Contract validation result for input/output checking.
 */
export interface ContractValidation {
  /** Whether the validation passed. */
  valid: boolean;
  /** Validation error messages if failed. */
  errors?: string[];
}

/**
 * A task in the reactor's internal execution queue.
 * Created when a node needs to be processed (entry traversal, handler execution, etc.).
 */
export interface ExecutionTask {
  /** The IR node to process. */
  nodeId: string;
  /** Context data passed to the handler. */
  context: unknown;
  /**
   * Optional resolve callback for action.run intent pattern.
   * When a handler calls `actions.run(step, input)`, the reactor creates a
   * task with a resolve function. The handler's Promise awaits this resolve.
   */
  resolve?: (result: unknown) => void;
}

/**
 * The runtime representation of a bundled handler module.
 *
 * Each handler is an isolated function that receives a {@link HandlerContext}
 * (from `@kalphq/sdk`) and returns a result. The reactor executes these in a
 * sandboxed context with intercepted primitives.
 */
export interface HandlerModule {
  /** The handler's entry function. */
  default: (context: unknown, input?: unknown) => Promise<unknown>;
}