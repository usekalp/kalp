export interface RuntimeMetrics {
  reloadCount: number;
  failedSwaps: number;
  activeExecutions: number;
  lastReloadDurationMs: number;
  lastCompileDurationMs: number;
  lastModuleLoadDurationMs: number;
  totalRestarts: number;
  totalHotSwaps: number;
  totalFullRestarts: number;
}
