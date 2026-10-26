import type { SpeechToTextEngine, TextToSpeechEngine } from "@open-bpo/core";
import { checked, type Fetch } from "./http";

export class SarvamSpeechToTextEngine implements SpeechToTextEngine {
  constructor(private readonly apiKey: string, private readonly fetch: Fetch = globalThis.fetch) {}
  async transcribe(chunk: string): Promise<string> {
    const body = new FormData();
    body.set("file", new Blob([chunk], { type: "audio/wav" }), "audio.wav");
    body.set("model", "saarika:v2.5");
    const response = await checked(await this.fetch("https://api.sarvam.ai/speech-to-text", { method: "POST", headers: { "api-subscription-key": this.apiKey }, body }));
    const result = await response.json() as { transcript?: string };
    return result.transcript ?? "";
  }
}

export class DeepgramSpeechToTextEngine implements SpeechToTextEngine {
  constructor(private readonly apiKey: string, private readonly fetch: Fetch = globalThis.fetch) {}
  async transcribe(chunk: string): Promise<string> {
    const response = await checked(await this.fetch("https://api.deepgram.com/v1/listen?model=nova-3", {
      method: "POST", headers: { authorization: `Token ${this.apiKey}`, "content-type": "audio/wav" }, body: chunk
    }));
    const result = await response.json() as { results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> } };
    return result.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  }
}

export class SarvamTextToSpeechEngine implements TextToSpeechEngine {
  constructor(private readonly apiKey: string, private readonly fetch: Fetch = globalThis.fetch) {}
  async synthesize(text: string): Promise<string> {
    const response = await checked(await this.fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST", headers: { "api-subscription-key": this.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ inputs: [text], target_language_code: "en-IN", model: "bulbul:v2" })
    }));
    const result = await response.json() as { audios?: string[] };
    return result.audios?.[0] ?? "";
  }
}

export class ElevenLabsTextToSpeechEngine implements TextToSpeechEngine {
  constructor(private readonly apiKey: string, private readonly voiceId: string, private readonly fetch: Fetch = globalThis.fetch) {}
  async synthesize(text: string): Promise<string> {
    const response = await checked(await this.fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voiceId)}`, {
      method: "POST", headers: { "xi-api-key": this.apiKey, accept: "audio/mpeg", "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" })
    }));
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
}
