import { Pool } from "pg";
import type { ScoreResult } from "@open-bpo/qa";

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calls (
      call_id TEXT PRIMARY KEY,
      direction TEXT NOT NULL DEFAULT 'inbound',
      duration_seconds INT NOT NULL,
      transcript JSONB NOT NULL,
      recipe_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS qa_results (
      call_id TEXT PRIMARY KEY REFERENCES calls(call_id) ON DELETE CASCADE,
      recipe_id TEXT NOT NULL,
      final_score INT NOT NULL,
      max_possible INT NOT NULL,
      qa_percent NUMERIC(5,2) NOT NULL,
      verdict TEXT NOT NULL,
      has_fatal_errors BOOLEAN NOT NULL,
      result JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      call_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'inbound',
      recipe_id TEXT NOT NULL,
      state TEXT NOT NULL,
      external_session_id TEXT,
      turns JSONB,
      trace JSONB,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'inbound';
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'inbound';
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS external_session_id TEXT;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS turns JSONB;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS error TEXT;
  `);
}

export async function persistQaResult(pool: Pool, payload: {
  callId: string;
  recipeId: string;
  result: ScoreResult;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO qa_results (
        call_id,
        recipe_id,
        final_score,
        max_possible,
        qa_percent,
        verdict,
        has_fatal_errors,
        result
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (call_id) DO UPDATE
      SET
        recipe_id = EXCLUDED.recipe_id,
        final_score = EXCLUDED.final_score,
        max_possible = EXCLUDED.max_possible,
        qa_percent = EXCLUDED.qa_percent,
        verdict = EXCLUDED.verdict,
        has_fatal_errors = EXCLUDED.has_fatal_errors,
        result = EXCLUDED.result,
        updated_at = NOW();
    `,
    [
      payload.callId,
      payload.recipeId,
      payload.result.finalScore,
      payload.result.maxPossible,
      payload.result.qaPercent,
      payload.result.verdict,
      payload.result.hasFatalErrors,
      JSON.stringify(payload.result)
    ]
  );
}

export async function updateSessionState(pool: Pool, payload: {
  sessionId: string;
  state: string;
  externalSessionId?: string;
  turns?: Array<{ speaker: string; text: string }>;
  trace?: string[];
  error?: string;
}): Promise<void> {
  await pool.query(
    `
      UPDATE sessions
      SET
        state = $2,
        external_session_id = COALESCE($3, external_session_id),
        turns = COALESCE($4::jsonb, turns),
        trace = COALESCE($5::jsonb, trace),
        error = COALESCE($6, error),
        updated_at = NOW()
      WHERE session_id = $1;
    `,
    [
      payload.sessionId,
      payload.state,
      payload.externalSessionId ?? null,
      payload.turns ? JSON.stringify(payload.turns) : null,
      payload.trace ? JSON.stringify(payload.trace) : null,
      payload.error ?? null
    ]
  );
}
