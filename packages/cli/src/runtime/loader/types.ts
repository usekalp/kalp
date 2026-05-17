export interface LoadedModule {
  module: unknown;
  defaultExport: Function;
  exports: Record<string, unknown>;
  loadedAt: Date;
}
