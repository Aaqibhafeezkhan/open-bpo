import { Worker } from "bullmq";
import IORedis from "ioredis";
import {
  MockLanguageModelEngine,
  MockSpeechToTextEngine,
  MockTextToSpeechEngine,
  QUEUES,
  runVoiceSessionLoop,
  type QaScoringJob,
  type SessionLoopJob
} from "@open-bpo/core";
import { providerFactory } from "@open-bpo/providers";
import { scoreTranscriptAgainstChecklist } from "@open-bpo/qa";
import { loadConfig } from "./config";
import { createPool, ensureSchema, persistQaResult, updateSessionState } from "./db";
import { getChecklist } from "./recipes";

async function bootstrapWithRetry(task: () => Promise<void>): Promise<void> {
  const maxAttempts = 20;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await task();
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      console.warn("worker bootstrap retry", { attempt, error });
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const redis = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const pool = createPool(config.DATABASE_URL);

  await bootstrapWithRetry(() => ensureSchema(pool));

  const qaWorker = new Worker<QaScoringJob>(
    QUEUES.qaScoring,
    async (job) => {
      const recipeId = job.data.recipeId || config.RECIPE_ID;
      const checklist = await getChecklist(recipeId);
      const result = scoreTranscriptAgainstChecklist({
        checklist,
        transcript: job.data.transcript
      });

      await persistQaResult(pool, {
        callId: job.data.callId,
        recipeId,
        result
      });

      return { callId: job.data.callId, qaPercent: result.qaPercent, verdict: result.verdict };
    },
    { connection: redis }
  );

  qaWorker.on("completed", (job, data) => {
    console.log("qa job completed", job.id, data);
  });

  qaWorker.on("failed", (job, error) => {
    console.error("qa job failed", job?.id, error);
  });

  const sessionWorker = new Worker<SessionLoopJob>(
    QUEUES.sessionLoop,
    async (job) => {
      const provider = providerFactory(job.data.provider);

      await updateSessionState(pool, {
        sessionId: job.data.sessionId,
        state: "assigned"
      });

      let externalSessionId: string | undefined;

      try {
        const handle = await provider.startSession({
          callId: job.data.callId,
          sessionId: job.data.sessionId,
          recipeId: job.data.recipeId
        });
        externalSessionId = handle.externalSessionId;

        await updateSessionState(pool, {
          sessionId: job.data.sessionId,
          state: "active",
          externalSessionId
        });

        const sessionResult = await runVoiceSessionLoop({
          userUtterances:
            job.data.seedUtterances.length > 0
              ? job.data.seedUtterances
              : ["Hello", "I need help with pricing", "Please schedule callback"],
          stt: new MockSpeechToTextEngine(),
          llm: new MockLanguageModelEngine(),
          tts: new MockTextToSpeechEngine(),
          tools: [
            {
              name: "schedule_callback",
              description: "Schedule a callback",
              async run() {
                return "callback_scheduled";
              }
            },
            {
              name: "crm_lookup",
              description: "Lookup CRM profile",
              async run(input) {
                return `crm_lookup_ok:${input.length}`;
              }
            }
          ]
        });

        await provider.stopSession(handle.externalSessionId);

        await updateSessionState(pool, {
          sessionId: job.data.sessionId,
          state: sessionResult.finalState,
          externalSessionId,
          turns: sessionResult.turns,
          trace: sessionResult.trace
        });

        return {
          sessionId: job.data.sessionId,
          state: sessionResult.finalState,
          traceLength: sessionResult.trace.length
        };
      } catch (error) {
        await updateSessionState(pool, {
          sessionId: job.data.sessionId,
          state: "failed",
          ...(externalSessionId ? { externalSessionId } : {}),
          error: error instanceof Error ? error.message : "Unknown session error"
        });

        throw error;
      }
    },
    { connection: redis }
  );

  sessionWorker.on("completed", (job, data) => {
    console.log("session job completed", job.id, data);
  });

  sessionWorker.on("failed", (job, error) => {
    console.error("session job failed", job?.id, error);
  });

  console.log("worker online", { queues: [QUEUES.qaScoring, QUEUES.sessionLoop] });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
