# Optional providers

All adapters are opt-in. With the selector variables unset (or set to `mock`), `pnpm demo` remains local and keyless. Copy `.env.example` to `.env`, choose providers, and fill only the variables for those providers. Never commit `.env`.

## Telephony

Set `TELEPHONY_PROVIDER=twilio` with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_TO_NUMBER`, and a public `MEDIA_STREAM_URL`. Twilio inbound webhooks can be parsed with `TwilioProvider.parseInboundWebhook()`; return `inboundResponse()` as `text/xml` to connect the call to the media WebSocket.

Set `TELEPHONY_PROVIDER=exotel` with `EXOTEL_ACCOUNT_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_FROM_NUMBER`, `EXOTEL_TO_NUMBER`, `EXOTEL_CALLER_ID`, and `MEDIA_STREAM_URL`. `EXOTEL_BASE_URL` is optional for regional API hosts. Use the matching parse/response methods for inbound Exotel webhooks.

Outbound sessions use the configured numbers by default. Code may override `from`, `to`, or `mediaStreamUrl` in `ProviderStartRequest`.

## Speech

For Sarvam STT, set `STT_PROVIDER=sarvam` and `SARVAM_API_KEY`. For Deepgram, set `STT_PROVIDER=deepgram` and `DEEPGRAM_API_KEY`.

For Sarvam TTS, set `TTS_PROVIDER=sarvam` and `SARVAM_API_KEY`. For ElevenLabs, set `TTS_PROVIDER=elevenlabs`, `ELEVENLABS_API_KEY`, and `ELEVENLABS_VOICE_ID`.

The simple core interfaces carry audio as strings: STT sends the string as WAV content, while TTS returns vendor-provided base64 (and base64-encodes ElevenLabs audio).

## LLM

Set `LLM_PROVIDER=openai`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `MODEL`. The base URL may be any OpenAI-compatible endpoint and may include `/chat/completions` already.

For Azure OpenAI, use the deployment base URL and set `AZURE_OPENAI_API_VERSION`. Azure URLs use the `api-key` header and an `api-version` query parameter; other endpoints use bearer authentication.

If any required variable is absent, that category logs one warning naming only the missing variables and uses its mock adapter.
