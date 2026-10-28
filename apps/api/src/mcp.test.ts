import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpenBpoClient, createOpenBpoMcpServer } from "@open-bpo/mcp/source";
import { buildDemoApp } from "./demo";

const apps: Awaited<ReturnType<typeof buildDemoApp>>[] = [];
const clients: Client[] = [];

function outputText(result: unknown): string {
  const content = (result as { content?: unknown }).content;
  const first = (content as Array<{ type: string; text?: string }> | undefined)?.[0];
  if (!first || first.type !== "text") throw new Error("Expected text tool output");
  if (typeof first.text !== "string") throw new Error("Expected text tool output");
  return first.text;
}

async function connect(clientApi: OpenBpoClient): Promise<Client> {
  const server = createOpenBpoMcpServer(clientApi);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "open-bpo-test", version: "0.1.0" });
  await client.connect(clientTransport);
  clients.push(client);
  return client;
}

async function startDemo(env: NodeJS.ProcessEnv = { NODE_ENV: "test", OPEN_BPO_ALLOW_NO_AUTH: "true" }) {
  const app = await buildDemoApp({ env });
  apps.push(app);
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  return new OpenBpoClient({ baseUrl: address, token: env.OPEN_BPO_API_TOKEN });
}

beforeEach(() => {
  delete process.env.OPEN_BPO_REDACT;
  delete process.env.OPEN_BPO_ALLOW_REAL_CALLS;
  delete process.env.TWILIO_AUTH_TOKEN;
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(apps.splice(0).map((app) => app.close()));
  delete process.env.OPEN_BPO_REDACT;
  delete process.env.OPEN_BPO_ALLOW_REAL_CALLS;
  delete process.env.TWILIO_AUTH_TOKEN;
});

describe("open-bpo MCP tools", () => {
  it("serves the tool catalog over streamable HTTP", async () => {
    const app = await buildDemoApp({ env: { NODE_ENV: "test", OPEN_BPO_ALLOW_NO_AUTH: "true" } });
    apps.push(app);
    const address = await app.listen({ host: "127.0.0.1", port: 0 });
    const client = new Client({ name: "open-bpo-http-test", version: "0.1.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${address}/mcp`)));
    clients.push(client);
    expect((await client.listTools()).tools.map((tool) => tool.name)).toContain("list_recipes");
  });

  it("lists tools and runs the mock call workflow against the demo API", async () => {
    const client = await connect(await startDemo());
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "list_recipes", "get_recipe", "start_demo_call", "list_calls", "get_call_qa",
      "list_live_sessions", "get_session_trace", "provider_status", "qa_summary"
    ]));

    const recipes = outputText(await client.callTool({ name: "list_recipes", arguments: {} }));
    expect(recipes).toContain("lead-qualification");
    const recipe = outputText(await client.callTool({ name: "get_recipe", arguments: { recipeId: "lead-qualification" } }));
    expect(recipe).toContain("Lead Qualification");

    const started = JSON.parse(outputText(await client.callTool({
      name: "start_demo_call", arguments: { direction: "inbound", recipeId: "lead-qualification", provider: "mock" }
    }))) as { callId: string };
    const calls = outputText(await client.callTool({ name: "list_calls", arguments: { direction: "inbound", limit: 10 } }));
    expect(calls).toContain(started.callId);
    const qa = outputText(await client.callTool({ name: "get_call_qa", arguments: { callId: started.callId, waitForScore: true } }));
    expect(qa).toContain('"status": "ready"');
  });

  it("returns provider status booleans without leaking environment values", async () => {
    const marker = "provider-secret-marker";
    process.env.TWILIO_AUTH_TOKEN = marker;
    const client = await connect(await startDemo({
      NODE_ENV: "test", OPEN_BPO_ALLOW_NO_AUTH: "true", TWILIO_ACCOUNT_SID: marker, TWILIO_AUTH_TOKEN: marker,
      TWILIO_FROM_NUMBER: marker, TWILIO_TO_NUMBER: marker, MEDIA_STREAM_URL: marker
    }));
    const text = outputText(await client.callTool({ name: "provider_status", arguments: {} }));
    expect(text).not.toContain(marker);
    expect(JSON.parse(text)).toMatchObject({ providers: expect.any(Array) });
    expect(text).toContain('"configured": true');
  });

  it("redacts email-like and phone-number-like text", async () => {
    process.env.OPEN_BPO_REDACT = "1";
    const email = "user" + "@" + "example.test";
    const phone = "98" + "7654" + "3210";
    const api = new OpenBpoClient({
      fetch: async () => new Response(JSON.stringify({ recipe: { prompt: `${email} ${phone}`, checklist: {}, tools: [] } }), {
        status: 200, headers: { "Content-Type": "application/json" }
      })
    });
    const client = await connect(api);
    const text = outputText(await client.callTool({ name: "get_recipe", arguments: { recipeId: "lead-qualification" } }));
    expect(text).not.toContain(email);
    expect(text).not.toContain(phone);
    expect(text).toContain("[redacted-email]");
    expect(text).toContain("[redacted-phone]");
  });

  it("refuses non-mock calls unless explicitly enabled", async () => {
    const client = await connect(await startDemo());
    const result = await client.callTool({ name: "start_demo_call", arguments: { direction: "outbound", provider: "twilio" } });
    expect(result.isError).toBe(true);
    expect(outputText(result)).toContain("Non-mock calls are disabled");
  });
});
