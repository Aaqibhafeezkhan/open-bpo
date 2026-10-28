import assert from "node:assert/strict";
import test from "node:test";
import {
  createProviderBundle,
  DeepgramSpeechToTextEngine,
  ElevenLabsTextToSpeechEngine,
  ExotelProvider,
  MockProvider,
  providerFactory,
  OpenAICompatibleLanguageModelEngine,
  SarvamSpeechToTextEngine,
  SarvamTextToSpeechEngine,
  TwilioProvider,
  type Fetch
} from "./index";

function stub(body: unknown, capture: Array<{ url: string; init?: RequestInit }> = []): Fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    capture.push({ url: String(input), ...(init ? { init } : {}) });
    return body instanceof Uint8Array
      ? new Response(Uint8Array.from(body).buffer, { status: 200 })
      : Response.json(body);
  }) as Fetch;
}

const request = { callId: "call-test", sessionId: "session-test", recipeId: "recipe-test" };

test("Twilio parses webhooks, emits TwiML, and creates and stops calls", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const provider = new TwilioProvider({ accountSid: "sid-test", authToken: "test-key", from: "+1000", to: "+2000", mediaStreamUrl: "wss://test.invalid/media?a=1&b=2" }, stub({ sid: "CA-test" }, calls));
  assert.deepEqual(provider.parseInboundWebhook("CallSid=CA-in&From=%2B3000&To=%2B4000"), { callId: "CA-in", from: "+3000", to: "+4000" });
  assert.match(provider.inboundResponse(), /a=1&amp;b=2/);
  assert.equal((await provider.startSession(request)).externalSessionId, "CA-test");
  await provider.stopSession("CA-test");
  assert.equal(calls.length, 2);
  assert.match(String(calls[0]?.init?.body), /Twiml=/);
  assert.equal(calls[1]?.init?.method, "POST");
});

test("Exotel parses webhooks and creates outbound calls", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const provider = new ExotelProvider({ accountSid: "sid-test", apiKey: "test-key", apiToken: "test-token", from: "1000", to: "2000", callerId: "3000", mediaStreamUrl: "wss://test.invalid/media" }, stub({ Call: { Sid: "exo-test" } }, calls));
  assert.deepEqual(provider.parseInboundWebhook({ CallUUID: "exo-in", DialWhomNumber: "1000", VirtualNumber: "2000" }), { callId: "exo-in", from: "1000", to: "2000" });
  assert.equal((await provider.startSession(request)).externalSessionId, "exo-test");
  assert.match(calls[0]?.url ?? "", /connect\.json$/);
  assert.match(provider.inboundResponse(), /<Stream/);
});

test("STT and TTS adapters map vendor responses", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  assert.equal(await new DeepgramSpeechToTextEngine("test-key", stub({ results: { channels: [{ alternatives: [{ transcript: "hello" }] }] } }, calls)).transcribe("audio"), "hello");
  assert.equal(await new SarvamSpeechToTextEngine("test-key", stub({ transcript: "namaste" }, calls)).transcribe("audio"), "namaste");
  assert.equal(await new SarvamTextToSpeechEngine("test-key", stub({ audios: ["base64-audio"] }, calls)).synthesize("hello"), "base64-audio");
  assert.equal(await new ElevenLabsTextToSpeechEngine("test-key", "voice-test", stub(new Uint8Array([1, 2, 3]), calls)).synthesize("hello"), "AQID");
  assert.equal(calls.length, 4);
});

test("OpenAI-compatible LLM supports standard and Azure authentication", async () => {
  const standardCalls: Array<{ url: string; init?: RequestInit }> = [];
  const standard = new OpenAICompatibleLanguageModelEngine({ baseUrl: "https://test.invalid/v1", apiKey: "test-key", model: "test-model" }, stub({ choices: [{ message: { content: "answer" } }] }, standardCalls));
  assert.deepEqual(await standard.respond({ messages: [{ role: "user", content: "question" }], tools: [] }), { type: "final", text: "answer" });
  assert.equal((standardCalls[0]?.init?.headers as Record<string, string>).authorization, "Bearer test-key");

  const azureCalls: Array<{ url: string; init?: RequestInit }> = [];
  const azure = new OpenAICompatibleLanguageModelEngine({ baseUrl: "https://test.openai.azure.com/openai/deployments/test", apiKey: "test-key", model: "test-model", azureApiVersion: "2025-test" }, stub({ choices: [{ message: { content: "azure-answer" } }] }, azureCalls));
  assert.deepEqual(await azure.respond({ messages: [{ role: "user", content: "question" }], tools: [] }), { type: "final", text: "azure-answer" });
  assert.match(azureCalls[0]?.url ?? "", /api-version=2025-test/);
  assert.equal((azureCalls[0]?.init?.headers as Record<string, string>)["api-key"], "test-key");
});

test("OpenAI-compatible LLM sends tools and history and parses tool calls", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const llm = new OpenAICompatibleLanguageModelEngine({ baseUrl: "https://test.invalid/v1", apiKey: "test-key", model: "test-model" }, stub({
    choices: [{ message: { content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "crm_lookup", arguments: "{\"phone\":\"123\"}" } }] } }]
  }, calls));
  const reply = await llm.respond({
    messages: [
      { role: "system", content: "be brief" },
      { role: "user", content: "who am I" },
      { role: "assistant", content: "", toolCalls: [{ id: "prev", name: "crm_lookup", arguments: { a: 1 } }] },
      { role: "tool", toolCallId: "prev", name: "crm_lookup", content: "ok" }
    ],
    tools: [{ name: "crm_lookup", description: "Lookup", parameters: { type: "object", properties: { phone: { type: "string" } } } }]
  });
  assert.deepEqual(reply, { type: "tool_calls", calls: [{ id: "call_1", name: "crm_lookup", arguments: { phone: "123" } }] });
  const body = JSON.parse(String(calls[0]?.init?.body)) as { tools: Array<{ function: { name: string } }>; messages: Array<Record<string, unknown>> };
  assert.equal(body.tools[0]?.function.name, "crm_lookup");
  assert.equal(body.messages[2]?.role, "assistant");
  assert.deepEqual(body.messages[3], { role: "tool", tool_call_id: "prev", content: "ok" });
});

test("factory defaults to mock and warns once with missing variable names", () => {
  assert.ok(createProviderBundle({}).telephony instanceof MockProvider);
  const warnings: unknown[][] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const bundle = createProviderBundle({ TELEPHONY_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "sid-test" });
    assert.ok(bundle.telephony instanceof MockProvider);
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0]?.[0]), /TWILIO_AUTH_TOKEN.*MEDIA_STREAM_URL/);
  assert.doesNotMatch(String(warnings[0]?.[0]), /sid-test/);
});

test("livekit is rejected loudly instead of silently returning a mock", () => {
  assert.throws(() => providerFactory("livekit", {}), /livekit.*not implemented/i);
  assert.throws(() => providerFactory(undefined, { TELEPHONY_PROVIDER: "livekit" }), /not implemented/i);
  assert.equal(providerFactory("mock", {}).provider, "mock");
});
