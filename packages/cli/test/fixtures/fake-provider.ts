import { vi } from "vitest";
import type { RuntimeProvider } from "@/utils/providers/types";

export function createFakeProvider(
  overrides: Partial<RuntimeProvider> = {},
): RuntimeProvider {
  return {
    name: "fake",
    login: vi.fn().mockResolvedValue(undefined),
    whoami: vi.fn().mockResolvedValue({
      provider: "fake",
      accountId: "fake-account-123",
      email: "test@example.com",
    }),
    putSecret: vi.fn().mockResolvedValue(undefined),
    listSecrets: vi.fn().mockResolvedValue([]),
    deleteSecret: vi.fn().mockResolvedValue(undefined),
    deployRuntime: vi.fn().mockResolvedValue({
      workerUrl: "https://test.workers.dev",
      customDomains: [],
      rawOutput: "deployed",
    }),
    putManifest: vi.fn().mockResolvedValue(undefined),
    putValue: vi.fn().mockResolvedValue(undefined),
    deleteValue: vi.fn().mockResolvedValue(undefined),
    getValue: vi.fn().mockResolvedValue(null),
    listKeys: vi.fn().mockResolvedValue([] as Array<{ name: string }>),
    listNamespaces: vi
      .fn()
      .mockResolvedValue([] as Array<{ id: string; title: string }>),
    ...overrides,
  };
}

export function createFakeEnv() {
  const env: Record<string, string> = {};
  return {
    get env() {
      return env;
    },
    setEnv(key: string, value: string) {
      env[key] = value;
    },
    deleteEnv(key: string) {
      delete env[key];
    },
  };
}
