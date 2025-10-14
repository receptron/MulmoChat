import { randomUUID } from "crypto";
import type {
  TextMessage,
  TextLLMProviderId,
  QueuedToolOutputPayload,
  TextSessionDefaults,
  TextSessionSnapshot,
  ToolDefinition,
} from "./types";

interface TextSession {
  id: string;
  provider: TextLLMProviderId;
  model: string;
  messages: TextMessage[];
  queuedInstructions: string[];
  queuedToolOutputs: QueuedToolOutputPayload[];
  defaults: TextSessionDefaults;
  tools?: ToolDefinition[];
  createdAt: number;
  updatedAt: number;
}

const SESSION_TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_STORED_SESSIONS = 200;

const sessions = new Map<string, TextSession>();

function cloneMessages(messages: TextMessage[]): TextMessage[] {
  return messages.map((msg) => ({ ...msg }));
}

function cloneToolOutputs(
  outputs: QueuedToolOutputPayload[],
): QueuedToolOutputPayload[] {
  return outputs.map((output) => ({ ...output }));
}

function cleanupExpiredSessions(): void {
  const expirationThreshold = Date.now() - SESSION_TTL_MS;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.updatedAt < expirationThreshold) {
      sessions.delete(sessionId);
    }
  }

  if (sessions.size <= MAX_STORED_SESSIONS) {
    return;
  }

  const orderedSessions = Array.from(sessions.values()).sort(
    (a, b) => a.updatedAt - b.updatedAt,
  );

  const excess = orderedSessions.length - MAX_STORED_SESSIONS;
  for (let i = 0; i < excess; i += 1) {
    sessions.delete(orderedSessions[i].id);
  }
}

function touch(session: TextSession): void {
  session.updatedAt = Date.now();
}

export function createTextSession(options: {
  provider: TextLLMProviderId;
  model: string;
  systemPrompt?: string;
  initialMessages?: TextMessage[];
  defaults?: TextSessionDefaults;
  tools?: ToolDefinition[];
}): TextSessionSnapshot {
  cleanupExpiredSessions();

  const now = Date.now();
  const session: TextSession = {
    id: randomUUID(),
    provider: options.provider,
    model: options.model,
    messages: [],
    queuedInstructions: [],
    queuedToolOutputs: [],
    defaults: options.defaults ? { ...options.defaults } : {},
    createdAt: now,
    updatedAt: now,
  };

  if (options.tools?.length) {
    session.tools = options.tools.map((tool) => ({ ...tool }));
  }

  if (options.systemPrompt) {
    session.messages.push({
      role: "system",
      content: options.systemPrompt,
    });
  }

  if (options.initialMessages?.length) {
    session.messages.push(...cloneMessages(options.initialMessages));
  }

  sessions.set(session.id, session);

  return serializeSession(session);
}

export function getTextSession(sessionId: string): TextSession | undefined {
  cleanupExpiredSessions();
  return sessions.get(sessionId);
}

export function deleteTextSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function appendSessionMessages(
  session: TextSession,
  messages: TextMessage[],
): void {
  session.messages.push(...messages.map((message) => ({ ...message })));
  touch(session);
}

export function queueSessionInstructions(
  session: TextSession,
  instructions: string[],
): void {
  if (!instructions.length) return;
  session.queuedInstructions.push(...instructions);
  touch(session);
}

export function queueSessionToolOutputs(
  session: TextSession,
  outputs: Array<Omit<QueuedToolOutputPayload, "addedAt">>,
): void {
  if (!outputs.length) return;
  const timestamp = Date.now();
  for (const output of outputs) {
    session.queuedToolOutputs.push({
      ...output,
      addedAt: timestamp,
    });
  }
  touch(session);
}

export function clearSessionQueues(session: TextSession): void {
  if (
    session.queuedInstructions.length === 0 &&
    session.queuedToolOutputs.length === 0
  ) {
    return;
  }
  session.queuedInstructions = [];
  session.queuedToolOutputs = [];
  touch(session);
}

export function serializeSession(session: TextSession): TextSessionSnapshot {
  return {
    id: session.id,
    provider: session.provider,
    model: session.model,
    messages: cloneMessages(session.messages),
    queuedInstructions: [...session.queuedInstructions],
    queuedToolOutputs: cloneToolOutputs(session.queuedToolOutputs),
    defaults: { ...session.defaults },
    tools: session.tools?.map((tool) => ({ ...tool })),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export function updateSessionDefaults(
  session: TextSession,
  defaults: TextSessionDefaults,
): void {
  session.defaults = {
    ...session.defaults,
    ...defaults,
  };
  touch(session);
}

export function listActiveSessions(): TextSessionSnapshot[] {
  cleanupExpiredSessions();
  return Array.from(sessions.values()).map(serializeSession);
}
