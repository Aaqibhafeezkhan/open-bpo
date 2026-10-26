import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerConsoleRoutes } from "./console-routes";

const apps: Array<ReturnType<typeof Fastify>> = [];

function buildApp(env: NodeJS.ProcessEnv = {}) {
  const app = Fastify();
  registerConsoleRoutes(app, { cwd: process.cwd(), env });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("console read-only endpoints", () => {
  it("returns prompt, checklist, and tools for a known recipe", async () => {
    const response = await buildApp().inject({ method: "GET", url: "/v1/recipes/lead-qualification" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.recipe.prompt).toContain("Lead Qualification");
    expect(body.recipe.checklist.items.length).toBeGreaterThan(0);
    expect(body.recipe.tools.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown and invalid recipe ids", async () => {
    const app = buildApp();
    const unknown = await app.inject({ method: "GET", url: "/v1/recipes/not-a-recipe" });
    const traversal = await app.inject({ method: "GET", url: "/v1/recipes/%2e%2e%2flead-qualification" });
    expect(unknown.statusCode).toBe(404);
    expect(traversal.statusCode).toBe(404);
  });

  it("reports only provider configuration booleans and never secret values", async () => {
    const marker = "sensitive-test-marker";
    const response = await buildApp({
      TWILIO_ACCOUNT_SID: marker,
      TWILIO_AUTH_TOKEN: marker,
      TWILIO_FROM_NUMBER: marker,
      TWILIO_TO_NUMBER: marker,
      MEDIA_STREAM_URL: marker
    }).inject({ method: "GET", url: "/v1/providers/status" });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(marker);
    expect(response.json().providers[0].providers).toContainEqual({ id: "twilio", name: "Twilio", configured: true });
  });
});
