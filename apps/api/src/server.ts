import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { OpenBpoClient, handleOpenBpoMcpHttp } from "@open-bpo/mcp/source";

const defaultOrigins = ["http://localhost:43123", "http://127.0.0.1:43123"];

export function assertProductionAuth(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === "production" && !env.OPEN_BPO_API_TOKEN?.trim()) {
    throw new Error("OPEN_BPO_API_TOKEN is required when NODE_ENV=production");
  }
}

function authorized(request: FastifyRequest, token: string): boolean {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const actual = createHash("sha256").update(header.slice(7)).digest();
  const expected = createHash("sha256").update(token).digest();
  return timingSafeEqual(actual, expected);
}

export async function registerApiFoundation(app: FastifyInstance, options: { env: NodeJS.ProcessEnv; title: string }): Promise<void> {
  assertProductionAuth(options.env);
  const configuredOrigins = options.env.OPEN_BPO_CORS_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];
  const origins = configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;
  await app.register(cors, { origin: origins });
  await app.register(swagger, {
    openapi: {
      info: { title: options.title, version: "0.1.0", description: "Call operations, recipes, sessions, and QA API." },
      servers: [{ url: "http://127.0.0.1:4017" }],
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } }
    }
  });
  app.addHook("onRoute", (route) => {
    if (route.url.startsWith("/v1/")) {
      route.schema = { ...route.schema, security: [{ bearerAuth: [] }] };
    }
  });

  const token = options.env.OPEN_BPO_API_TOKEN?.trim();
  app.addHook("onRequest", async (request, reply) => {
    if (!token || (!request.url.startsWith("/v1/") && !request.url.startsWith("/mcp"))) return;
    if (!authorized(request, token)) return reply.code(401).send({ error: "Unauthorized" });
  });

  app.get("/docs/openapi.json", { schema: { hide: true } }, async () => app.swagger());
  app.get("/llms.txt", { schema: { hide: true } }, async (_request, reply) => {
    const candidates = [path.resolve(process.cwd(), "llms.txt"), path.resolve(process.cwd(), "..", "..", "llms.txt")];
    for (const candidate of candidates) {
      try {
        return reply.type("text/plain").send(await readFile(candidate, "utf8"));
      } catch {
        // Try the workspace-root candidate.
      }
    }
    return reply.code(404).send("Not found");
  });
}

export function registerMcpRoutes(app: FastifyInstance, options: { env: NodeJS.ProcessEnv; apiUrl: string }): void {
  const client = new OpenBpoClient({ baseUrl: options.apiUrl, token: options.env.OPEN_BPO_API_TOKEN });
  app.route({
    method: ["POST", "GET", "DELETE"],
    url: "/mcp",
    schema: { tags: ["MCP"], summary: "Streamable HTTP MCP transport", security: [{ bearerAuth: [] }] },
    handler: async (request, reply) => {
      reply.hijack();
      await handleOpenBpoMcpHttp({ request: request.raw, response: reply.raw, body: request.body, client });
    }
  });
}
