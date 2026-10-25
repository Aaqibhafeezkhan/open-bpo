import type { CallSession, SessionEvent } from "./types";

export function createCallSession(input: {
  sessionId: string;
  callId: string;
  provider: CallSession["provider"];
  recipeId: string;
}): CallSession {
  const now = new Date().toISOString();
  return {
    sessionId: input.sessionId,
    callId: input.callId,
    provider: input.provider,
    recipeId: input.recipeId,
    state: "pending",
    createdAt: now,
    updatedAt: now
  };
}

export function applySessionEvent(session: CallSession, event: SessionEvent): CallSession {
  const updatedAt = event.at;

  switch (event.type) {
    case "SESSION_ASSIGNED":
      return { ...session, state: "assigned", updatedAt };
    case "SESSION_STARTED":
      return { ...session, state: "active", updatedAt };
    case "SESSION_COMPLETED":
      return { ...session, state: "completed", updatedAt };
    case "SESSION_FAILED":
      return { ...session, state: "failed", updatedAt };
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}
