import {
  MockLanguageModelEngine, MockSpeechToTextEngine, MockTextToSpeechEngine,
  type LanguageModelEngine, type SessionProvider, type SpeechToTextEngine, type TextToSpeechEngine
} from "@open-bpo/core";
import type { Fetch } from "./http";
import { OpenAICompatibleLanguageModelEngine } from "./llm";
import { DeepgramSpeechToTextEngine, ElevenLabsTextToSpeechEngine, SarvamSpeechToTextEngine, SarvamTextToSpeechEngine } from "./speech";
import { ExotelProvider, MockProvider, TwilioProvider, type Provider } from "./telephony";

export * from "./http";
export * from "./llm";
export * from "./speech";
export * from "./telephony";

export type ProviderEnvironment = Record<string, string | undefined>;
export interface ProviderBundle { telephony: Provider; stt: SpeechToTextEngine; tts: TextToSpeechEngine; llm: LanguageModelEngine; }

function values(env: ProviderEnvironment, names: string[], selected: string): string[] | undefined {
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) {
    console.warn(`${selected} provider disabled; missing env vars: ${missing.join(", ")}. Falling back to mock.`);
    return undefined;
  }
  return names.map((name) => env[name] as string);
}

export function providerFactory(provider?: SessionProvider, env: ProviderEnvironment = process.env, fetch: Fetch = globalThis.fetch): Provider {
  provider ??= (["twilio", "exotel", "livekit", "mock"].includes(env.TELEPHONY_PROVIDER ?? "") ? env.TELEPHONY_PROVIDER : "mock") as SessionProvider;
  if (provider === "livekit") {
    throw new Error("The livekit telephony provider is not implemented yet (it was a mock stub). Use TELEPHONY_PROVIDER=mock, twilio, or exotel.");
  }
  if (provider === "twilio") {
    const config = values(env, ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "TWILIO_TO_NUMBER", "MEDIA_STREAM_URL"], "twilio");
    return config ? new TwilioProvider({ accountSid: config[0]!, authToken: config[1]!, from: config[2]!, to: config[3]!, mediaStreamUrl: config[4]! }, fetch) : new MockProvider();
  }
  if (provider === "exotel") {
    const config = values(env, ["EXOTEL_ACCOUNT_SID", "EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_FROM_NUMBER", "EXOTEL_TO_NUMBER", "EXOTEL_CALLER_ID", "MEDIA_STREAM_URL"], "exotel");
    return config ? new ExotelProvider({ accountSid: config[0]!, apiKey: config[1]!, apiToken: config[2]!, from: config[3]!, to: config[4]!, callerId: config[5]!, mediaStreamUrl: config[6]!, ...(env.EXOTEL_BASE_URL ? { baseUrl: env.EXOTEL_BASE_URL } : {}) }, fetch) : new MockProvider();
  }
  return new MockProvider();
}

export function createProviderBundle(env: ProviderEnvironment = process.env, fetch: Fetch = globalThis.fetch): ProviderBundle {
  const telephony = providerFactory(undefined, env, fetch);

  let stt: SpeechToTextEngine = new MockSpeechToTextEngine();
  if (env.STT_PROVIDER === "sarvam") {
    const config = values(env, ["SARVAM_API_KEY"], "sarvam STT");
    if (config) stt = new SarvamSpeechToTextEngine(config[0]!, fetch);
  } else if (env.STT_PROVIDER === "deepgram") {
    const config = values(env, ["DEEPGRAM_API_KEY"], "deepgram STT");
    if (config) stt = new DeepgramSpeechToTextEngine(config[0]!, fetch);
  }

  let tts: TextToSpeechEngine = new MockTextToSpeechEngine();
  if (env.TTS_PROVIDER === "sarvam") {
    const config = values(env, ["SARVAM_API_KEY"], "sarvam TTS");
    if (config) tts = new SarvamTextToSpeechEngine(config[0]!, fetch);
  } else if (env.TTS_PROVIDER === "elevenlabs") {
    const config = values(env, ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"], "elevenlabs TTS");
    if (config) tts = new ElevenLabsTextToSpeechEngine(config[0]!, config[1]!, fetch);
  }

  let llm: LanguageModelEngine = new MockLanguageModelEngine();
  if (env.LLM_PROVIDER === "openai") {
    const config = values(env, ["OPENAI_BASE_URL", "OPENAI_API_KEY", "MODEL"], "openai LLM");
    if (config) llm = new OpenAICompatibleLanguageModelEngine({ baseUrl: config[0]!, apiKey: config[1]!, model: config[2]!, ...(env.AZURE_OPENAI_API_VERSION ? { azureApiVersion: env.AZURE_OPENAI_API_VERSION } : {}) }, fetch);
  }
  return { telephony, stt, tts, llm };
}
