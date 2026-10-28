import type { ChatMessage, LanguageModelEngine, LanguageModelRequest, ModelReply, ToolCall } from "@open-bpo/core";
import { checked, type Fetch } from "./http";

export interface OpenAICompatibleConfig { baseUrl: string; apiKey: string; model: string; azureApiVersion?: string; }

interface WireToolCall { id?: string; function?: { name?: string; arguments?: string } }

function toWireMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === "tool") return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
  if (message.role === "assistant" && message.toolCalls?.length) {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } }))
    };
  }
  return { role: message.role, content: message.content };
}

function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export class OpenAICompatibleLanguageModelEngine implements LanguageModelEngine {
  constructor(private readonly config: OpenAICompatibleConfig, private readonly fetch: Fetch = globalThis.fetch) {}
  async respond(input: LanguageModelRequest): Promise<ModelReply> {
    const azure = Boolean(this.config.azureApiVersion) || this.config.baseUrl.includes("azure");
    const endpoint = this.config.baseUrl.endsWith("/chat/completions") ? this.config.baseUrl : `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const url = new URL(endpoint);
    if (azure) url.searchParams.set("api-version", this.config.azureApiVersion ?? "2024-10-21");
    const body: Record<string, unknown> = { model: this.config.model, messages: input.messages.map(toWireMessage) };
    if (input.tools.length > 0) {
      body.tools = input.tools.map((tool) => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.parameters ?? { type: "object", properties: {} } }
      }));
    }
    const response = await checked(await this.fetch(url, {
      method: "POST",
      headers: { [azure ? "api-key" : "authorization"]: azure ? this.config.apiKey : `Bearer ${this.config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body)
    }));
    const result = await response.json() as { choices?: Array<{ message?: { content?: string | null; tool_calls?: WireToolCall[] } }> };
    const message = result.choices?.[0]?.message;
    const wireCalls = message?.tool_calls ?? [];
    if (wireCalls.length > 0 && input.tools.length > 0) {
      const calls: ToolCall[] = wireCalls.map((call, index) => ({
        id: call.id ?? `call_${index}`,
        name: call.function?.name ?? "",
        arguments: parseArguments(call.function?.arguments)
      }));
      return { type: "tool_calls", calls, ...(message?.content ? { text: message.content } : {}) };
    }
    return { type: "final", text: message?.content ?? "" };
  }
}
