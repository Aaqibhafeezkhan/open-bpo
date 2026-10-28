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

/** JSON Schema describing a tool's arguments (OpenAI function-calling `parameters`). */
export type ToolParameters = Record<string, unknown>;

/** A tool definition as declared in a recipe's `tools.json`. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters?: ToolParameters;
}

/** A runnable tool: its spec plus a handler. */
export interface AgentTool extends ToolSpec {
  run(args: Record<string, unknown>): Promise<string>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Conversation history in the shape of the OpenAI chat format. */
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

/** What the model decided to do next. */
export type ModelReply =
  | { type: "final"; text: string }
  | { type: "tool_calls"; calls: ToolCall[]; text?: string };

export interface VoiceTurn {
  speaker: "caller" | "agent";
  text: string;
}

export interface VoiceSessionResult {
  finalState: SessionState;
  turns: VoiceTurn[];
  trace: string[];
}
