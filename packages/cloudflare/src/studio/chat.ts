import {
  readChatMessages,
  readChatSessions,
  writeChatMessages,
  writeChatSessions,
} from "@/kv-storage";
import { inferTextFromAgentResponse, makeId } from "@/shared";

type EnvWithKv = { KALP_MANIFESTS: KVNamespace };

interface ChatSession {
  id: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  metadata: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  executionId?: string;
  status: string;
}

export async function ensureChatSession(
  env: EnvWithKv,
  agentName: string,
  sessionId: string,
  title: string,
): Promise<ChatSession> {
  const currentSessions = await readChatSessions<ChatSession>(env, agentName);
  const existing = currentSessions.find((session) => session.id === sessionId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const next: ChatSession = {
    id: sessionId,
    agentName,
    createdAt: now,
    updatedAt: now,
    title: title || "New session",
    metadata: {},
  };
  await writeChatSessions(env, agentName, [next, ...currentSessions].slice(0, 100));
  return next;
}

export async function appendChatMessage(
  env: EnvWithKv,
  agentName: string,
  sessionId: string,
  message: ChatMessage,
): Promise<void> {
  const current = await readChatMessages<ChatMessage>(env, agentName, sessionId);
  const next = [...current, message];
  await writeChatMessages(env, agentName, sessionId, next);
}

export async function touchChatSession(
  env: EnvWithKv,
  agentName: string,
  sessionId: string,
  patch: Partial<ChatSession> = {},
): Promise<void> {
  const current = await readChatSessions<ChatSession>(env, agentName);
  const next = current.map((session) =>
    session.id === sessionId
      ? { ...session, ...patch, updatedAt: new Date().toISOString() }
      : session,
  );
  await writeChatSessions(env, agentName, next);
}

interface HandleChatParams {
  env: EnvWithKv;
  agentName: string;
  message: string;
  sessionId?: string;
  invoke: () => Promise<{ executionId: string; output: unknown }>;
}

export async function handleChatMessage(params: HandleChatParams) {
  const { env, agentName, message, sessionId = makeId("chat"), invoke } = params;

  const session = await ensureChatSession(env, agentName, sessionId, message.slice(0, 80));
  const userMessage: ChatMessage = {
    id: makeId("msg"),
    role: "user",
    content: message,
    createdAt: new Date().toISOString(),
    status: "completed",
  };
  await appendChatMessage(env, agentName, session.id, userMessage);

  const { executionId, output } = await invoke();

  const assistantMessage: ChatMessage = {
    id: makeId("msg"),
    role: "assistant",
    content: inferTextFromAgentResponse(output),
    createdAt: new Date().toISOString(),
    executionId,
    status: "completed",
  };
  await appendChatMessage(env, agentName, session.id, assistantMessage);
  await touchChatSession(env, agentName, session.id, {});

  return {
    session,
    executionId,
    message: assistantMessage,
  };
}