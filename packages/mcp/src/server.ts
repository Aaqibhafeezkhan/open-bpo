import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { OpenBpoClient } from "./client.js";

type JsonRecord = Record<string, unknown>;

function redact(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/(?<!\w)(?:\+?\d[\s().-]?){9,15}(?!\w)/g, "[redacted-phone]");
}

function maskCredentialValues(value: string): string {
  let masked = value;
  for (const [name, secret] of Object.entries(process.env)) {
    if (!secret || secret.length < 4 || !/(?:SECRET|TOKEN|PASSWORD|CREDENTIAL|API_KEY|AUTH_KEY)/i.test(name)) continue;
    masked = masked.split(secret).join("[redacted-secret]");
  }
  return masked;
}

function textResult(value: unknown, shouldRedact: boolean) {
  const text = maskCredentialValues(JSON.stringify(value, null, 2));
  return { content: [{ type: "text" as const, text: shouldRedact ? redact(text) : text }] };
}

function resourceText(value: unknown, shouldRedact: boolean): string {
  const text = maskCredentialValues(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  return shouldRedact ? redact(text) : text;
}

const readOnly = { readOnlyHint: true, destructiveHint: false } as const;
const mutating = { readOnlyHint: false, destructiveHint: false } as const;

export function createOpenBpoMcpServer(client: OpenBpoClient): McpServer {
  const server = new McpServer({ name: "open-bpo", version: "0.1.0" });
  const shouldRedact = process.env.OPEN_BPO_REDACT === "1";

  server.registerTool("list_recipes", { description: "List available call recipes.", inputSchema: {}, annotations: readOnly }, async () => {
    const { data } = await client.get<{ recipes: JsonRecord[] }>("/v1/recipes");
    const recipes = await Promise.all(data.recipes.map(async (recipe) => {
      const id = String(recipe.id);
      const detail = await client.get<{ recipe: { checklist?: { name?: string; items?: unknown[] } } }>(`/v1/recipes/${encodeURIComponent(id)}`);
      return { ...recipe, name: detail.data.recipe.checklist?.name ?? id, checkCount: detail.data.recipe.checklist?.items?.length ?? 0 };
    }));
    return textResult({ recipes }, shouldRedact);
  });

  server.registerTool("get_recipe", {
    description: "Get a recipe prompt, checklist, and tool declarations.",
    inputSchema: { recipeId: z.string().min(1) }, annotations: readOnly
  }, async ({ recipeId }) => textResult((await client.get(`/v1/recipes/${encodeURIComponent(recipeId)}`)).data, shouldRedact));

  server.registerTool("start_demo_call", {
    description: "Start a sample inbound or outbound call.",
    inputSchema: {
      direction: z.enum(["inbound", "outbound"]),
      recipeId: z.string().default("lead-qualification"),
      provider: z.enum(["mock", "twilio"]).default("mock")
    }, annotations: mutating
  }, async ({ direction, recipeId, provider }) => {
    if (provider !== "mock" && process.env.OPEN_BPO_ALLOW_REAL_CALLS !== "1") {
      return { isError: true, ...textResult({ error: "Non-mock calls are disabled. Set OPEN_BPO_ALLOW_REAL_CALLS=1 to enable them." }, shouldRedact) };
    }
    const result = await client.post(`/v1/demo/calls/${direction}`, { recipeId, provider, startSession: true });
    return textResult(result.data, shouldRedact);
  });

  server.registerTool("list_calls", {
    description: "List recent calls, optionally filtered.",
    inputSchema: {
      verdict: z.string().optional(), recipeId: z.string().optional(),
      direction: z.enum(["inbound", "outbound"]).optional(), limit: z.number().int().min(1).max(50).default(50)
    }, annotations: readOnly
  }, async ({ verdict, recipeId, direction, limit }) => {
    const { data } = await client.get<{ calls: JsonRecord[] }>("/v1/calls");
    const calls = data.calls.filter((call) =>
      (!verdict || call.verdict === verdict) && (!recipeId || call.recipeId === recipeId) && (!direction || call.direction === direction)
    ).slice(0, limit);
    return textResult({ calls }, shouldRedact);
  });

  server.registerTool("get_call_qa", {
    description: "Get a call transcript and QA result, optionally waiting for scoring.",
    inputSchema: { callId: z.string().min(1), waitForScore: z.boolean().default(false) }, annotations: readOnly
  }, async ({ callId, waitForScore }) => {
    const deadline = Date.now() + 20_000;
    let result = await client.get<JsonRecord>(`/v1/calls/${encodeURIComponent(callId)}/qa`);
    while (waitForScore && result.status === 202 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      result = await client.get<JsonRecord>(`/v1/calls/${encodeURIComponent(callId)}/qa`);
    }
    return textResult(result.data, shouldRedact);
  });

  server.registerTool("list_live_sessions", {
    description: "List live call sessions, optionally filtered by state.",
    inputSchema: { state: z.string().optional() }, annotations: readOnly
  }, async ({ state }) => {
    const { data } = await client.get<{ sessions: JsonRecord[] }>("/v1/sessions");
    return textResult({ sessions: state ? data.sessions.filter((session) => session.state === state) : data.sessions }, shouldRedact);
  });

  server.registerTool("get_session_trace", {
    description: "Get one live session and its trace.",
    inputSchema: { sessionId: z.string().min(1) }, annotations: readOnly
  }, async ({ sessionId }) => textResult((await client.get(`/v1/sessions/${encodeURIComponent(sessionId)}`)).data, shouldRedact));

  server.registerTool("provider_status", { description: "Show provider readiness as booleans only.", inputSchema: {}, annotations: readOnly }, async () => {
    const { data } = await client.get<{ providers: Array<{ id: string; name: string; providers: Array<{ id: string; name: string; configured: boolean }> }> }>("/v1/providers/status");
    const providers = data.providers.map((group) => ({ id: group.id, name: group.name, providers: group.providers.map((provider) => ({ id: provider.id, name: provider.name, configured: Boolean(provider.configured) })) }));
    return textResult({ providers }, shouldRedact);
  });

  server.registerTool("qa_summary", {
    description: "Summarize recent QA results with pass rate, fatal count, and the most common failing check.",
    inputSchema: { recipeId: z.string().optional() }, annotations: readOnly
  }, async ({ recipeId }) => {
    const { data } = await client.get<{ calls: JsonRecord[] }>("/v1/calls");
    const calls = data.calls.filter((call) => !recipeId || call.recipeId === recipeId).slice(0, 50);
    const scored = calls.filter((call) => typeof call.verdict === "string");
    const failures = new Map<string, { title: string; count: number }>();
    for (const call of scored) {
      const detail = await client.get<{ status: string; call?: { qa?: { result?: { breakdown?: Array<{ id: string; title: string; score: number; maxScore: number }> } } } }>(`/v1/calls/${encodeURIComponent(String(call.callId))}/qa`);
      for (const item of detail.data.call?.qa?.result?.breakdown ?? []) {
        if (item.score < item.maxScore) failures.set(item.id, { title: item.title, count: (failures.get(item.id)?.count ?? 0) + 1 });
      }
    }
    const top = [...failures.entries()].sort((a, b) => b[1].count - a[1].count)[0];
    return textResult({
      total: calls.length, scored: scored.length,
      passRate: scored.length ? Math.round((scored.filter((call) => call.verdict === "pass").length / scored.length) * 100) : null,
      fatalCount: scored.filter((call) => call.hasFatalErrors === true).length,
      topFailingCheck: top ? { id: top[0], ...top[1] } : null
    }, shouldRedact);
  });

  server.registerResource("recipe-prompt", new ResourceTemplate("recipe://{id}/prompt", { list: undefined }), { description: "Recipe agent prompt", mimeType: "text/markdown" }, async (uri, { id }) => {
    const { data } = await client.get<{ recipe: { prompt: string } }>(`/v1/recipes/${encodeURIComponent(String(id))}`);
    return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: resourceText(data.recipe.prompt, shouldRedact) }] };
  });
  server.registerResource("recipe-checklist", new ResourceTemplate("recipe://{id}/checklist", { list: undefined }), { description: "Recipe QA checklist", mimeType: "application/json" }, async (uri, { id }) => {
    const { data } = await client.get<{ recipe: { checklist: unknown } }>(`/v1/recipes/${encodeURIComponent(String(id))}`);
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: resourceText(data.recipe.checklist, shouldRedact) }] };
  });
  server.registerResource("call-transcript", new ResourceTemplate("call://{id}/transcript", { list: undefined }), { description: "Call transcript", mimeType: "application/json" }, async (uri, { id }) => {
    const { data } = await client.get<{ call?: { transcript?: unknown } }>(`/v1/calls/${encodeURIComponent(String(id))}/qa`);
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: resourceText(data.call?.transcript ?? [], shouldRedact) }] };
  });
  server.registerResource("quickstart", "openbpo://docs/quickstart", { description: "open-bpo agent quickstart", mimeType: "text/markdown" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text: "# open-bpo quickstart\n\nRun `pnpm demo`, then use `list_recipes` and `start_demo_call` with the mock provider." }]
  }));

  server.registerPrompt("review_failed_calls", { description: "Review failed calls and suggest focused recipe improvements.", argsSchema: { recipeId: z.string().optional() } }, ({ recipeId }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Use list_calls${recipeId ? ` for recipe ${recipeId}` : ""} with verdict fail, inspect each result with get_call_qa, explain recurring failed checks, and suggest precise recipe edits.` } }]
  }));
  server.registerPrompt("write_recipe", { description: "Draft the files for a new open-bpo recipe.", argsSchema: { goal: z.string().min(1) } }, ({ goal }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Draft prompt.md, checklist.json, and tools.json for this goal: ${goal}. Follow docs/RECIPE_AUTHORING.md and do not include credentials.` } }]
  }));
  server.registerPrompt("daily_qa_report", { description: "Create a concise daily QA report.", argsSchema: { recipeId: z.string().optional() } }, ({ recipeId }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Use qa_summary${recipeId ? ` for recipe ${recipeId}` : ""} and recent calls to report pass rate, fatal failures, and the leading failed check.` } }]
  }));

  return server;
}
