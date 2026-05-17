import type { RuntimeState } from "../types";
import { validTransitions } from "../types";
import { RuntimeStateError } from "../errors";

export class RuntimeLifecycle {
  private state: RuntimeState = "idle";

  getState(): RuntimeState {
    return this.state;
  }

  assertState(...allowed: RuntimeState[]): void {
    if (!allowed.includes(this.state)) {
      throw new RuntimeStateError(this.state, allowed.join(" | "));
    }
  }

  transition(to: RuntimeState): void {
    const allowed = validTransitions[this.state];
    if (!allowed?.includes(to)) {
      throw new RuntimeStateError(this.state, to);
    }
    this.state = to;
  }
}
