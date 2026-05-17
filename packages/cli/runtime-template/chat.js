import {
  readChatMessages,
  readChatSessions,
  writeChatMessages,
  writeChatSessions,
} from "./storage.js";
import { inferTextFromAgentResponse, makeId } from "./shared.js";

export async function ensureChatSession(env, agentName, sessionId, title) {
  const currentSessions = await readChatSessions(env, agentName);
  const existing = currentSessions.find((session) => session.id === sessionId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const next = {
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

export async function appendChatMessage(env, agentName, sessionId, message) {
  const current = await readChatMessages(env, agentName, sessionId);
  const next = [...current, message];
  await writeChatMessages(env, agentName, sessionId, next);
}

export async function touchChatSession(env, agentName, sessionId, patch = {}) {
  const current = await readChatSessions(env, agentName);
  const next = current.map((session) =>
    session.id === sessionId
      ? { ...session, ...patch, updatedAt: new Date().toISOString() }
      : session,
  );
  await writeChatSessions(env, agentName, next);
}

export async function handleChatMessage(params) {
  const {
    env,
    agentName,
    message,
    sessionId = makeId("chat"),
    invoke,
  } = params;

  const session = await ensureChatSession(env, agentName, sessionId, message.slice(0, 80));
  const userMessage = {
    id: makeId("msg"),
    role: "user",
    content: message,
    createdAt: new Date().toISOString(),
    status: "completed",
  };
  await appendChatMessage(env, agentName, session.id, userMessage);

  const { executionId, output } = await invoke();

  const assistantMessage = {
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
