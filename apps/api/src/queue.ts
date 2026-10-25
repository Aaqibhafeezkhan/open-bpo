import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { QaScoringJob, SessionLoopJob } from "@open-bpo/core";
import { QUEUES } from "@open-bpo/core";

export interface QueueClients {
  qaQueue: Queue<QaScoringJob>;
  sessionQueue: Queue<SessionLoopJob>;
}

export function createQueues(redisUrl: string): QueueClients {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  return {
    qaQueue: new Queue<QaScoringJob>(QUEUES.qaScoring, { connection }),
    sessionQueue: new Queue<SessionLoopJob>(QUEUES.sessionLoop, { connection })
  };
}
