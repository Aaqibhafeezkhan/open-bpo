import { Pool } from "pg";

export interface CallRecord {
  callId: string;
  direction: "inbound" | "outbound";
  durationSeconds: number;
  transcript: unknown;
  recipeId: string;
}

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

export async function upsertCall(pool: Pool, call: CallRecord): Promise<void> {
  await pool.query(
    `
      INSERT INTO calls (call_id, direction, duration_seconds, transcript, recipe_id)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      ON CONFLICT (call_id) DO UPDATE
      SET direction = EXCLUDED.direction,
          duration_seconds = EXCLUDED.duration_seconds,
          transcript = EXCLUDED.transcript,
          recipe_id = EXCLUDED.recipe_id,
          updated_at = NOW();
    `,
    [call.callId, call.direction, call.durationSeconds, JSON.stringify(call.transcript), call.recipeId]
  );
}

export async function createSessionRecord(pool: Pool, session: {
  sessionId: string;
  callId: string;
  provider: string;
  direction: "inbound" | "outbound";
  recipeId: string;
  state: string;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO sessions (session_id, call_id, provider, direction, recipe_id, state)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (session_id) DO NOTHING;
    `,
    [session.sessionId, session.callId, session.provider, session.direction, session.recipeId, session.state]
  );
}

export async function listCalls(pool: Pool): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query(`
    SELECT
      c.call_id,
      c.direction,
      c.duration_seconds,
      c.recipe_id,
      c.created_at,
      q.qa_percent,
      q.verdict,
      q.has_fatal_errors,
      s.state AS latest_session_state
    FROM calls c
    LEFT JOIN qa_results q ON q.call_id = c.call_id
    LEFT JOIN LATERAL (
      SELECT state
      FROM sessions
      WHERE sessions.call_id = c.call_id
      ORDER BY updated_at DESC
      LIMIT 1
    ) s ON true
    ORDER BY c.created_at DESC
    LIMIT 200;
  `);

  return result.rows.map((row: any) => ({
    callId: row.call_id,
    direction: row.direction,
    durationSeconds: row.duration_seconds,
    recipeId: row.recipe_id,
    createdAt: row.created_at,
    qaPercent: row.qa_percent === null ? null : Number(row.qa_percent),
    verdict: row.verdict,
    hasFatalErrors: row.has_fatal_errors,
    latestSessionState: row.latest_session_state
  }));
}

export async function getQaResult(pool: Pool, callId: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `
      SELECT c.call_id, c.direction, c.duration_seconds, c.recipe_id, c.transcript, c.created_at,
             q.final_score, q.max_possible, q.qa_percent, q.verdict, q.has_fatal_errors, q.result, q.updated_at
      FROM calls c
      LEFT JOIN qa_results q ON q.call_id = c.call_id
      WHERE c.call_id = $1
      LIMIT 1;
    `,
    [callId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    callId: row.call_id,
    direction: row.direction,
    durationSeconds: row.duration_seconds,
    recipeId: row.recipe_id,
    transcript: row.transcript,
    createdAt: row.created_at,
    qa: row.result
      ? {
          finalScore: row.final_score,
          maxPossible: row.max_possible,
          qaPercent: Number(row.qa_percent),
          verdict: row.verdict,
          hasFatalErrors: row.has_fatal_errors,
          updatedAt: row.updated_at,
          result: row.result
        }
      : null
  };
}

export async function listSessions(pool: Pool): Promise<Array<Record<string, unknown>>> {
  const result = await pool.query(`
    SELECT session_id, call_id, provider, direction, recipe_id, state,
           external_session_id, turns, trace, error, created_at, updated_at
    FROM sessions
    ORDER BY created_at DESC
    LIMIT 200;
  `);

  return result.rows.map((row: any) => ({
    sessionId: row.session_id,
    callId: row.call_id,
    provider: row.provider,
    direction: row.direction,
    recipeId: row.recipe_id,
    state: row.state,
    externalSessionId: row.external_session_id,
    turns: row.turns,
    trace: row.trace,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function getSession(pool: Pool, sessionId: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `
      SELECT session_id, call_id, provider, direction, recipe_id, state,
             external_session_id, turns, trace, error, created_at, updated_at
      FROM sessions
      WHERE session_id = $1
      LIMIT 1;
    `,
    [sessionId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    sessionId: row.session_id,
    callId: row.call_id,
    provider: row.provider,
    direction: row.direction,
    recipeId: row.recipe_id,
    state: row.state,
    externalSessionId: row.external_session_id,
    turns: row.turns,
    trace: row.trace,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
