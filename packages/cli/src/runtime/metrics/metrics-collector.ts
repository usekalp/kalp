import type { RuntimeMetrics } from "./types";

export class MetricsCollector {
  private metrics: RuntimeMetrics = {
    reloadCount: 0,
    failedSwaps: 0,
    activeExecutions: 0,
    lastReloadDurationMs: 0,
    lastCompileDurationMs: 0,
    lastModuleLoadDurationMs: 0,
    totalRestarts: 0,
    totalHotSwaps: 0,
    totalFullRestarts: 0,
  };

  startReload(): () => void {
    const start = performance.now();
    return () => {
      this.metrics.reloadCount++;
      this.metrics.lastReloadDurationMs = performance.now() - start;
    };
  }

  startCompile(): () => void {
    const start = performance.now();
    return () => {
      this.metrics.lastCompileDurationMs = performance.now() - start;
    };
  }

  startModuleLoad(): () => void {
    const start = performance.now();
    return () => {
      this.metrics.lastModuleLoadDurationMs = performance.now() - start;
    };
  }

  recordHotSwap(): void {
    this.metrics.totalHotSwaps++;
  }

  recordFullRestart(): void {
    this.metrics.totalRestarts++;
    this.metrics.totalFullRestarts++;
  }

  recordFailedSwap(): void {
    this.metrics.failedSwaps++;
  }

  setActiveExecutions(count: number): void {
    this.metrics.activeExecutions = count;
  }

  getSnapshot(): RuntimeMetrics {
    return { ...this.metrics };
  }
}
