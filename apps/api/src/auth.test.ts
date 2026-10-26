import { afterEach, describe, expect, it } from "vitest";
import { buildDemoApp } from "./demo";

const apps: Awaited<ReturnType<typeof buildDemoApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("API authentication", () => {
  it("keeps health open and protects v1 routes when configured", async () => {
    const token = "test-auth-marker";
    const app = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_API_TOKEN: token } });
    apps.push(app);

    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/recipes" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/v1/recipes", headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/mcp" })).statusCode).toBe(401);
  });

  it("refuses production startup without a token", async () => {
    await expect(buildDemoApp({ env: { NODE_ENV: "production" } })).rejects.toThrow("OPEN_BPO_API_TOKEN is required");
  });
});
