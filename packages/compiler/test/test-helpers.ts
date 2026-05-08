import { clearRegistry } from "@kalphq/sdk";

/**
 * Executes a handler bundle from its code string.
 * Clears the registry before execution to avoid collisions.
 */
export function executeBundleFromCode(code: string) {
  clearRegistry(); // Clear registry to avoid collisions when the bundle re-registers nodes during evaluation
  // The bundle is an IIFE that returns the __handler object (which contains the default export)
  const bundleResult = eval(code);
  return bundleResult.default;
}
