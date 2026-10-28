import type { AgentTool, ChatMessage, ModelReply, ToolCall, ToolSpec, VoiceSessionResult, VoiceTurn } from "./types";

export interface SpeechToTextEngine {
  transcribe(chunk: string): Promise<string>;
}

export interface LanguageModelRequest {
  /** Full conversation so far (system prompt, caller turns, tool calls and results). */
  messages: ChatMessage[];
  /** Tools the model may call. Empty means the model must answer in text. */
  tools: ToolSpec[];
}

export interface LanguageModelEngine {
  respond(input: LanguageModelRequest): Promise<ModelReply>;
}

export interface TextToSpeechEngine {
  synthesize(text: string): Promise<string>;
}

export const DEFAULT_MAX_TOOL_ITERATIONS = 5;
const MAX_TOOL_OUTPUT_CHARS = 2000;
const CAP_FALLBACK_REPLY = "Let me have a specialist follow up with you on that.";

export class MockSpeechToTextEngine implements SpeechToTextEngine {
  async transcribe(chunk: string): Promise<string> {
    return chunk.trim();
  }
}

function cannedReply(input: string): string {
  const normalized = input.toLowerCase();
  if (normalized.includes("budget")) {
    return "Great, sharing service options. What monthly budget range is comfortable for you?";
  }
  if (normalized.includes("demo") || normalized.includes("callback")) {
    return "Noted. I can schedule a callback with a specialist. What date works for you?";
  }
  return "Understood. Let me capture that and ask one more qualifying question.";
}

// Deterministic intents for the key-free demo. Each intent only fires when one
// of its candidate tools is actually offered, so it works with any recipe.
const MOCK_INTENTS: Array<{ keywords: string[]; tools: string[] }> = [
  { keywords: ["callback", "call back"], tools: ["schedule_callback"] },
  { keywords: ["brochure"], tools: ["send_brochure"] },
  { keywords: ["escalate"], tools: ["ticket_escalate"] },
  { keywords: ["account", "ticket", "lookup", "status"], tools: ["account_summary", "ticket_lookup", "crm_lookup"] }
];

/**
 * A scripted stand-in for a real model: it decides on tool calls itself (the
 * loop never pattern-matches), and answers with canned text once tool results
 * are in. Lets `pnpm demo` exercise the full tool loop without API keys.
 */
export class MockLanguageModelEngine implements LanguageModelEngine {
  private callCounter = 0;

  async respond(input: LanguageModelRequest): Promise<ModelReply> {
    const last = input.messages[input.messages.length - 1];
    const lastUser = [...input.messages].reverse().find((message) => message.role === "user");
    const userText = lastUser?.content ?? "";

    if (last?.role === "tool") {
      const results: string[] = [];
      for (let index = input.messages.length - 1; index >= 0; index -= 1) {
        const message = input.messages[index]!;
        if (message.role !== "tool") break;
        results.unshift(`${message.name} -> ${message.content}`);
      }
      return { type: "final", text: `${cannedReply(userText)} (${results.join("; ")})` };
    }

    const normalized = userText.toLowerCase();
    const offered = new Set(input.tools.map((tool) => tool.name));
    const calls: ToolCall[] = [];
    for (const intent of MOCK_INTENTS) {
      if (!intent.keywords.some((keyword) => normalized.includes(keyword))) continue;
      const name = intent.tools.find((candidate) => offered.has(candidate));
      if (name && !calls.some((call) => call.name === name)) {
        this.callCounter += 1;
        calls.push({ id: `mock_call_${this.callCounter}`, name, arguments: { request: userText } });
      }
    }
    if (calls.length > 0) return { type: "tool_calls", calls };
    return { type: "final", text: cannedReply(userText) };
  }
}

export class MockTextToSpeechEngine implements TextToSpeechEngine {
  async synthesize(text: string): Promise<string> {
    return text;
  }
}

async function runTool(tools: Map<string, AgentTool>, call: ToolCall): Promise<string> {
  const tool = tools.get(call.name);
  if (!tool) return `error: unknown tool "${call.name}"`;
  try {
    const output = await tool.run(call.arguments);
    return output.length > MAX_TOOL_OUTPUT_CHARS ? `${output.slice(0, MAX_TOOL_OUTPUT_CHARS)}…[truncated]` : output;
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : "tool failed"}`;
  }
}

export async function runVoiceSessionLoop(input: {
  userUtterances: string[];
  stt: SpeechToTextEngine;
  llm: LanguageModelEngine;
  tts: TextToSpeechEngine;
  tools?: AgentTool[];
  /** System prompt, normally the recipe's prompt.md. */
  systemPrompt?: string;
  /** Max model round-trips that may request tools per caller turn. */
  maxToolIterations?: number;
}): Promise<VoiceSessionResult> {
  const turns: VoiceTurn[] = [];
  const trace: string[] = [];
  const maxIterations = input.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
  const agentTools = input.tools ?? [];
  const toolsByName = new Map(agentTools.map((tool) => [tool.name, tool]));
  const toolSpecs: ToolSpec[] = agentTools.map(({ name, description, parameters }) => ({
    name,
    description,
    ...(parameters ? { parameters } : {})
  }));
  const messages: ChatMessage[] = input.systemPrompt ? [{ role: "system", content: input.systemPrompt }] : [];

  for (const utterance of input.userUtterances) {
    const text = await input.stt.transcribe(utterance);
    turns.push({ speaker: "caller", text });
    trace.push(`caller:${text}`);
    messages.push({ role: "user", content: text });

    let finalText: string | undefined;
    for (let iteration = 0; iteration < maxIterations && finalText === undefined; iteration += 1) {
      const reply = await input.llm.respond({ messages, tools: toolSpecs });
      if (reply.type === "final") {
        finalText = reply.text;
        break;
      }
      messages.push({ role: "assistant", content: reply.text ?? "", toolCalls: reply.calls });
      for (const call of reply.calls) {
        trace.push(`tool_call:${call.name}:${JSON.stringify(call.arguments)}`);
        const output = await runTool(toolsByName, call);
        trace.push(`tool:${call.name}:${output}`);
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: output });
      }
    }

    if (finalText === undefined) {
      // Iteration cap hit: make the model answer without tools, else use a safe fallback.
      trace.push(`loop:iteration_cap:${maxIterations}`);
      const forced = await input.llm.respond({ messages, tools: [] });
      finalText = forced.type === "final" && forced.text ? forced.text : CAP_FALLBACK_REPLY;
    }

    messages.push({ role: "assistant", content: finalText });
    const spoken = await input.tts.synthesize(finalText);
    turns.push({ speaker: "agent", text: spoken });
    trace.push(`agent:${spoken}`);
  }

  return {
    finalState: "completed",
    turns,
    trace
  };
}
