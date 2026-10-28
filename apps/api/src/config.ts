import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4017),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  DATABASE_URL: z.string().default("postgresql://open_bpo:open_bpo@localhost:5432/open_bpo"),
  RECIPE_ID: z.string().default("lead-qualification"),
  OPEN_BPO_API_TOKEN: z.string().min(1).optional(),
  OPEN_BPO_CORS_ORIGINS: z.string().optional()
});

export type ApiConfig = z.infer<typeof envSchema>;

export function loadConfig(): ApiConfig {
  if (process.env.NODE_ENV === "production" && !process.env.OPEN_BPO_API_TOKEN?.trim()) {
    throw new Error("OPEN_BPO_API_TOKEN is required when NODE_ENV=production");
  }
  const config = envSchema.parse(process.env);
  return config;
}
