export type SessionState = "pending" | "assigned" | "active" | "completed" | "failed";

export type SessionProvider = "twilio" | "exotel" | "livekit" | "mock";

export interface TranscriptTurn {
  speaker: "caller" | "agent";
  text: string;
  timestamp: string;
}

export interface CallSession {
  sessionId: string;
  callId: string;
  provider: SessionProvider;
  state: SessionState;
  recipeId: string;
  createdAt: string;
  updatedAt: string;
}

export type SessionEvent =
  | { type: "SESSION_ASSIGNED"; at: string }
  | { type: "SESSION_STARTED"; at: string }
  | { type: "SESSION_COMPLETED"; at: string }
  | { type: "SESSION_FAILED"; at: string; reason: string };

export interface AgentTool {
  name: string;
  description: string;
  run(input: string): Promise<string>;
}

export interface VoiceTurn {
  speaker: "caller" | "agent";
  text: string;
}

export interface VoiceSessionResult {
  finalState: SessionState;
  turns: VoiceTurn[];
  trace: string[];
}
