import type { FastifyInstance } from "fastify";
import { getRecipeDetail } from "./recipes";

interface ProviderDefinition {
  id: string;
  name: string;
  required: string[];
}

const providerGroups: Array<{ id: string; name: string; providers: ProviderDefinition[] }> = [
  {
    id: "phone",
    name: "Phone line",
    providers: [
      { id: "mock", name: "Mock", required: [] },
      {
        id: "twilio",
        name: "Twilio",
        required: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "TWILIO_TO_NUMBER", "MEDIA_STREAM_URL"]
      },
      {
        id: "exotel",
        name: "Exotel",
        required: ["EXOTEL_ACCOUNT_SID", "EXOTEL_API_KEY", "EXOTEL_API_TOKEN", "EXOTEL_FROM_NUMBER", "EXOTEL_TO_NUMBER", "EXOTEL_CALLER_ID", "MEDIA_STREAM_URL"]
      },
      { id: "livekit", name: "LiveKit", required: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] }
    ]
  },
  {
    id: "speech-to-text",
    name: "Speech to text",
    providers: [
      { id: "mock", name: "Mock", required: [] },
      { id: "sarvam", name: "Sarvam", required: ["SARVAM_API_KEY"] },
      { id: "deepgram", name: "Deepgram", required: ["DEEPGRAM_API_KEY"] }
    ]
  },
  {
    id: "voice",
    name: "Voice",
    providers: [
      { id: "mock", name: "Mock", required: [] },
      { id: "sarvam", name: "Sarvam", required: ["SARVAM_API_KEY"] },
      { id: "elevenlabs", name: "ElevenLabs", required: ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] }
    ]
  },
  {
    id: "language-model",
    name: "Language model",
    providers: [
      { id: "mock", name: "Mock", required: [] },
      { id: "openai-compatible", name: "OpenAI-compatible", required: ["OPENAI_BASE_URL", "OPENAI_API_KEY", "MODEL"] }
    ]
  }
];

export function getProviderStatus(env: NodeJS.ProcessEnv) {
  return providerGroups.map((group) => ({
    id: group.id,
    name: group.name,
    providers: group.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      configured: provider.required.every((variable) => Boolean(env[variable]?.trim()))
    }))
  }));
}

export function registerConsoleRoutes(app: FastifyInstance, options: { cwd: string; env: NodeJS.ProcessEnv }): void {
  app.get<{ Params: { recipeId: string } }>("/v1/recipes/:recipeId", async (request, reply) => {
    const detail = await getRecipeDetail(options.cwd, request.params.recipeId);
    if (!detail) return reply.code(404).send({ error: "Recipe not found" });
    return { recipe: detail };
  });

  app.get("/v1/providers/status", async () => ({ providers: getProviderStatus(options.env) }));
}
