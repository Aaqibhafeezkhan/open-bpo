import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4017),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  DATABASE_URL: z.string().default("postgresql://open_bpo:open_bpo@localhost:5432/open_bpo"),
  RECIPE_ID: z.string().default("lead-qualification")
});

export type ApiConfig = z.infer<typeof envSchema>;

export function loadConfig(): ApiConfig {
  return envSchema.parse(process.env);
}
