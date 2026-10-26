import type { SessionProvider, TranscriptTurn } from "./types";

export const QUEUES = {
  qaScoring: "qa-scoring",
  sessionLoop: "session-loop"
} as const;

export interface QaScoringJob {
  callId: string;
  durationSeconds: number;
  transcript: TranscriptTurn[];
  recipeId: string;
}

export interface SessionLoopJob {
  sessionId: string;
  callId: string;
  provider: SessionProvider;
  recipeId: string;
  seedUtterances: string[];
}
