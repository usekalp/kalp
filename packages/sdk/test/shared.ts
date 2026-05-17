import { vi } from "vitest";
import type {
  KalpContext,
  KalpAI,
  KalpMemory,
  KalpVault,
  KalpAuth,
  KalpLog,
  StoragePrimitive,
  asUserId,
  WakeReason,
  KalpMcp,
  AgentIntrospection,
  KalpDate,
  KalpMath,
  KalpHistoryMessage,
} from "../src";

export const createMockContext = (): KalpContext => ({
  ai: {
    generate: vi.fn(),
    stream: vi.fn(),
    classify: vi.fn(),
  } as unknown as KalpAI,

  memory: {
    list: vi.fn(),
    append: vi.fn(),
    summarize: vi.fn(),
  } as unknown as KalpMemory,

  vault: {
    get: vi.fn().mockResolvedValue("secret-value"),
  } as unknown as KalpVault,

  storage: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    increment: vi.fn().mockResolvedValue(1),
    transaction: vi.fn((callback) =>
      callback({
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn(),
        delete: vi.fn(),
        increment: vi.fn().mockResolvedValue(1),
        list: vi.fn().mockResolvedValue([]),
      }),
    ),
    list: vi.fn().mockResolvedValue([]),
  } as unknown as StoragePrimitive,

  auth: {
    userId: "u-1" as ReturnType<typeof asUserId>,
    providerId: "test-provider",
    claims: {},
    hasPermission: vi.fn().mockReturnValue(false),
  } as unknown as KalpAuth,

  actions: {
    run: vi.fn(),
    wait: vi.fn().mockResolvedValue({ type: "timeout" } as WakeReason),
    loop: vi.fn(),
    fetch: vi.fn().mockResolvedValue(new Response()),
    ask: vi.fn(),
    requestApproval: vi.fn().mockResolvedValue(true),
    emit: vi.fn(),
    dispatch: vi.fn().mockResolvedValue(undefined),
    callAgent: vi.fn(),
    waitUntil: vi.fn(),
    schedule: vi.fn(),
  } as any,

  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  } as unknown as KalpLog,

  mcp: {} as unknown as KalpMcp,

  agent: {
    id: "test-agent",
    name: "Test Agent",
  } as unknown as AgentIntrospection,

  date: {
    now: vi.fn().mockReturnValue(Date.now()),
    toISOString: vi.fn().mockReturnValue(new Date().toISOString()),
  } as unknown as KalpDate,

  math: {
    random: vi.fn().mockReturnValue(0.5),
  } as unknown as KalpMath,

  history: [] as KalpHistoryMessage[],
  state: {},
});

export const createMockContextWith = (
  overrides: Partial<KalpContext>,
): KalpContext => ({
  ...createMockContext(),
  ...overrides,
});
