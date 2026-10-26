import type { LanguageModelEngine } from "@open-bpo/core";
import { checked, type Fetch } from "./http";

export interface OpenAICompatibleConfig { baseUrl: string; apiKey: string; model: string; azureApiVersion?: string; }

export class OpenAICompatibleLanguageModelEngine implements LanguageModelEngine {
  constructor(private readonly config: OpenAICompatibleConfig, private readonly fetch: Fetch = globalThis.fetch) {}
  async respond(input: string): Promise<string> {
    const azure = Boolean(this.config.azureApiVersion) || this.config.baseUrl.includes("azure");
    const endpoint = this.config.baseUrl.endsWith("/chat/completions") ? this.config.baseUrl : `${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const url = new URL(endpoint);
    if (azure) url.searchParams.set("api-version", this.config.azureApiVersion ?? "2024-10-21");
    const response = await checked(await this.fetch(url, {
      method: "POST",
      headers: { [azure ? "api-key" : "authorization"]: azure ? this.config.apiKey : `Bearer ${this.config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.config.model, messages: [{ role: "user", content: input }] })
    }));
    const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return result.choices?.[0]?.message?.content ?? "";
  }
}
