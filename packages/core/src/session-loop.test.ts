import assert from "node:assert/strict";
import test from "node:test";
import {
  MockLanguageModelEngine, MockSpeechToTextEngine, MockTextToSpeechEngine, runVoiceSessionLoop,
  type AgentTool, type LanguageModelEngine, type LanguageModelRequest, type ModelReply
} from "./index";

function tool(name: string, run: AgentTool["run"] = async () => `${name}_ok`): AgentTool {
  return { name, description: name, run };
}

function scripted(replies: ModelReply[], seen: LanguageModelRequest[] = []): LanguageModelEngine {
  let index = 0;
  return {
    async respond(input) {
      seen.push({ messages: structuredClone(input.messages), tools: input.tools });
      return replies[Math.min(index++, replies.length - 1)]!;
    }
  };
}

const base = { stt: new MockSpeechToTextEngine(), tts: new MockTextToSpeechEngine() };

test("model-driven tool call result is fed back before the final answer", async () => {
  const seen: LanguageModelRequest[] = [];
  const received: Array<Record<string, unknown>> = [];
  const result = await runVoiceSessionLoop({
    ...base,
    userUtterances: ["hello there"],
    systemPrompt: "You are an agent.",
    tools: [tool("crm_lookup", async (args) => { received.push(args); return "lead:found"; })],
    llm: scripted([
      { type: "tool_calls", calls: [{ id: "c1", name: "crm_lookup", arguments: { phone: "123" } }] },
      { type: "final", text: "Found you." }
    ], seen)
  });
  assert.deepEqual(received, [{ phone: "123" }]);
  assert.deepEqual(result.turns, [{ speaker: "caller", text: "hello there" }, { speaker: "agent", text: "Found you." }]);
  assert.ok(result.trace.includes("tool:crm_lookup:lead:found"));
  const second = seen[1]!.messages;
  assert.equal(second[0]?.role, "system");
  assert.deepEqual(second.at(-1), { role: "tool", toolCallId: "c1", name: "crm_lookup", content: "lead:found" });
  assert.equal(seen[0]!.tools[0]?.name, "crm_lookup");
});

test("a tool name in the caller's words does not trigger the tool", async () => {
  let runs = 0;
  const result = await runVoiceSessionLoop({
    ...base,
    userUtterances: ["please run crm_lookup and schedule_callback"],
    tools: [tool("crm_lookup", async () => { runs += 1; return "x"; })],
    llm: scripted([{ type: "final", text: "ok" }])
  });
  assert.equal(runs, 0);
  assert.equal(result.trace.some((line) => line.startsWith("tool:")), false);
});

test("history accumulates across caller utterances", async () => {
  const seen: LanguageModelRequest[] = [];
  await runVoiceSessionLoop({
    ...base,
    userUtterances: ["first", "second"],
    llm: scripted([{ type: "final", text: "a1" }, { type: "final", text: "a2" }], seen)
  });
  assert.deepEqual(seen[1]!.messages.map((message) => message.role === "tool" ? "tool" : `${message.role}:${message.content}`), ["user:first", "assistant:a1", "user:second"]);
});

test("unknown tools and tool errors are returned to the model, not thrown", async () => {
  const seen: LanguageModelRequest[] = [];
  const result = await runVoiceSessionLoop({
    ...base,
    userUtterances: ["go"],
    tools: [tool("boom", async () => { throw new Error("backend down"); })],
    llm: scripted([
      { type: "tool_calls", calls: [{ id: "a", name: "boom", arguments: {} }, { id: "b", name: "missing", arguments: {} }] },
      { type: "final", text: "sorry" }
    ], seen)
  });
  assert.equal(result.finalState, "completed");
  assert.ok(result.trace.includes("tool:boom:error: backend down"));
  assert.ok(result.trace.includes('tool:missing:error: unknown tool "missing"'));
});

test("iteration cap stops runaway tool calls and forces a text answer", async () => {
  let runs = 0;
  const seen: LanguageModelRequest[] = [];
  const looping: LanguageModelEngine = {
    async respond(input) {
      seen.push(input);
      return input.tools.length === 0
        ? { type: "final", text: "wrapping up" }
        : { type: "tool_calls", calls: [{ id: `c${seen.length}`, name: "t", arguments: {} }] };
    }
  };
  const result = await runVoiceSessionLoop({ ...base, userUtterances: ["go"], tools: [tool("t", async () => { runs += 1; return "r"; })], llm: looping, maxToolIterations: 3 });
  assert.equal(runs, 3);
  assert.ok(result.trace.includes("loop:iteration_cap:3"));
  assert.deepEqual(result.turns.at(-1), { speaker: "agent", text: "wrapping up" });
});

test("iteration cap falls back to a safe reply if the model never answers", async () => {
  const stubborn: LanguageModelEngine = { async respond() { return { type: "tool_calls", calls: [{ id: "x", name: "t", arguments: {} }] }; } };
  const result = await runVoiceSessionLoop({ ...base, userUtterances: ["go"], tools: [tool("t")], llm: stubborn, maxToolIterations: 2 });
  assert.match(result.turns.at(-1)!.text, /specialist/);
});

test("mock model calls only tools the recipe offers, then answers", async () => {
  const run = (tools: AgentTool[]) => runVoiceSessionLoop({ ...base, userUtterances: ["Please schedule callback"], tools, llm: new MockLanguageModelEngine() });
  const withTool = await run([tool("schedule_callback", async () => "callback_scheduled")]);
  assert.ok(withTool.trace.includes("tool:schedule_callback:callback_scheduled"));
  assert.match(withTool.turns.at(-1)!.text, /schedule a callback/);
  const without = await run([tool("ticket_lookup")]);
  assert.equal(without.trace.some((line) => line.startsWith("tool:")), false);
  assert.match(without.turns.at(-1)!.text, /schedule a callback/);
});
