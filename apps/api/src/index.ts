import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import type { SessionLoopJob, TranscriptTurn } from "@open-bpo/core";
import { createCallSession } from "@open-bpo/core";
import {
  createPool,
  createSessionRecord,
  ensureSchema,
  getQaResult,
  getSession,
  listCalls,
  listSessions,
  upsertCall
} from "./db";
import { createQueues } from "./queue";
import { listRecipeSummaries } from "./recipes";
import { loadConfig } from "./config";
import { buildDemoTranscript } from "./demo-data";
import { registerConsoleRoutes } from "./console-routes";

const callEndedSchema = z.object({
  callId: z.string().min(1),
  direction: z.enum(["inbound", "outbound"]).default("inbound"),
  duration: z.number().int().nonnegative(),
  transcript: z.union([
    z.string().min(1),
    z.array(
      z.object({
        speaker: z.enum(["caller", "agent"]),
        text: z.string().min(1),
        timestamp: z.string().default(() => new Date().toISOString())
      })
    )
  ]),
  recipeId: z.string().optional(),
  startSession: z.boolean().default(false),
  provider: z.enum(["twilio", "livekit", "mock"]).default("mock")
});

const createSessionSchema = z.object({
  callId: z.string().min(1),
  direction: z.enum(["inbound", "outbound"]).default("inbound"),
  provider: z.enum(["twilio", "livekit", "mock"]).default("mock"),
  recipeId: z.string().default("lead-qualification"),
  seedUtterances: z.array(z.string().min(1)).default([])
});

const demoCallSchema = z.object({
  recipeId: z.string().default("lead-qualification"),
  provider: z.enum(["twilio", "livekit", "mock"]).default("mock"),
  startSession: z.boolean().default(true)
});

function transcriptToTurns(transcript: string | TranscriptTurn[]): TranscriptTurn[] {
  if (typeof transcript === "string") {
    return [
      {
        speaker: "caller",
        text: transcript,
        timestamp: new Date().toISOString()
      }
    ];
  }

  return transcript;
}

function extractSeedUtterances(turns: TranscriptTurn[]): string[] {
  return turns.filter((turn) => turn.speaker === "caller").map((turn) => turn.text);
}

async function bootstrapWithRetry(task: () => Promise<void>, logger: { warn: (...args: unknown[]) => void }): Promise<void> {
  const maxAttempts = 20;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await task();
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      logger.warn({ attempt, error }, "bootstrap dependency not ready, retrying");
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

async function queueSession(input: {
  sessionQueue: ReturnType<typeof createQueues>["sessionQueue"];
  pool: ReturnType<typeof createPool>;
  callId: string;
  direction: "inbound" | "outbound";
  provider: "twilio" | "livekit" | "mock";
  recipeId: string;
  seedUtterances: string[];
}): Promise<{ sessionId: string; jobId: string | null }> {
  const sessionId = randomUUID();

  const session = createCallSession({
    sessionId,
    callId: input.callId,
    provider: input.provider,
    recipeId: input.recipeId
  });

  await createSessionRecord(input.pool, {
    sessionId: session.sessionId,
    callId: session.callId,
    provider: session.provider,
    direction: input.direction,
    recipeId: session.recipeId,
    state: session.state
  });

  const jobPayload: SessionLoopJob = {
    sessionId: session.sessionId,
    callId: session.callId,
    provider: session.provider,
    recipeId: session.recipeId,
    seedUtterances: input.seedUtterances
  };

  const job = await input.sessionQueue.add(`session-${session.sessionId}`, jobPayload, {
    removeOnComplete: 100,
    removeOnFail: 100
  });

  return { sessionId: session.sessionId, jobId: typeof job.id === "string" ? job.id : null };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  const pool = createPool(config.DATABASE_URL);
  await bootstrapWithRetry(() => ensureSchema(pool), app.log);

  const queues = createQueues(config.REDIS_URL);

  app.get("/health", async () => ({ status: "ok", service: "open-bpo-api" }));

  app.get("/v1/recipes", async () => {
    const recipes = await listRecipeSummaries(process.cwd());
    return { recipes };
  });
  registerConsoleRoutes(app, { cwd: process.cwd(), env: process.env });

  app.get("/v1/calls", async () => {
    const calls = await listCalls(pool);
    return { calls };
  });

  app.get("/v1/calls/:callId/qa", async (request, reply) => {
    const params = z.object({ callId: z.string().min(1) }).parse(request.params);
    const result = await getQaResult(pool, params.callId);

    if (!result) {
      return reply.code(404).send({ error: "Call not found" });
    }

    if (!result.qa) {
      return reply.code(202).send({ status: "pending", callId: params.callId });
    }

    return { status: "ready", call: result };
  });

  app.get("/v1/sessions", async () => {
    const sessions = await listSessions(pool);
    return { sessions };
  });

  app.get("/v1/sessions/:sessionId", async (request, reply) => {
    const params = z.object({ sessionId: z.string().min(1) }).parse(request.params);
    const session = await getSession(pool, params.sessionId);

    if (!session) {
      return reply.code(404).send({ error: "Session not found" });
    }

    return { session };
  });

  app.post("/v1/webhooks/call-ended", async (request, reply) => {
    const payload = callEndedSchema.parse(request.body);
    const recipeId = payload.recipeId ?? config.RECIPE_ID;
    const transcriptTurns = transcriptToTurns(payload.transcript);

    await upsertCall(pool, {
      callId: payload.callId,
      direction: payload.direction,
      durationSeconds: payload.duration,
      transcript: transcriptTurns,
      recipeId
    });

    const qaJob = await queues.qaQueue.add(
      `qa-${payload.callId}`,
      {
        callId: payload.callId,
        durationSeconds: payload.duration,
        transcript: transcriptTurns,
        recipeId
      },
      {
        removeOnComplete: 100,
        removeOnFail: 100,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000
        }
      }
    );

    let session: { sessionId: string; jobId: string | null } | null = null;

    if (payload.startSession) {
      session = await queueSession({
        sessionQueue: queues.sessionQueue,
        pool,
        callId: payload.callId,
        direction: payload.direction,
        provider: payload.provider,
        recipeId,
        seedUtterances: extractSeedUtterances(transcriptTurns)
      });
    }

    return reply.code(202).send({
      status: "queued",
      callId: payload.callId,
      qaJobId: qaJob.id,
      session
    });
  });

  app.post("/v1/sessions", async (request, reply) => {
    const payload = createSessionSchema.parse(request.body);

    const session = await queueSession({
      sessionQueue: queues.sessionQueue,
      pool,
      callId: payload.callId,
      direction: payload.direction,
      provider: payload.provider,
      recipeId: payload.recipeId,
      seedUtterances: payload.seedUtterances
    });

    return reply.code(202).send({ status: "queued", ...session });
  });

  app.post("/v1/demo/calls/:direction", async (request, reply) => {
    const params = z.object({ direction: z.enum(["inbound", "outbound"]) }).parse(request.params);
    const payload = demoCallSchema.parse(request.body ?? {});

    const callId = `${params.direction}-${Date.now()}`;
    const transcript = buildDemoTranscript(params.direction, payload.recipeId);

    await upsertCall(pool, {
      callId,
      direction: params.direction,
      durationSeconds: params.direction === "inbound" ? 210 : 180,
      transcript,
      recipeId: payload.recipeId
    });

    const qaJob = await queues.qaQueue.add(
      `qa-${callId}`,
      {
        callId,
        durationSeconds: params.direction === "inbound" ? 210 : 180,
        transcript,
        recipeId: payload.recipeId
      },
      {
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );

    let session: { sessionId: string; jobId: string | null } | null = null;
    if (payload.startSession) {
      session = await queueSession({
        sessionQueue: queues.sessionQueue,
        pool,
        callId,
        direction: params.direction,
        provider: payload.provider,
        recipeId: payload.recipeId,
        seedUtterances: extractSeedUtterances(transcript)
      });
    }

    return reply.code(202).send({
      status: "queued",
      callId,
      direction: params.direction,
      qaJobId: qaJob.id,
      session
    });
  });

  await app.listen({ host: "0.0.0.0", port: config.API_PORT });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
