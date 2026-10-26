import type { SessionProvider } from "@open-bpo/core";
import { basicAuth, checked, formBody, type Fetch, xmlEscape } from "./http";

export interface ProviderStartRequest {
  callId: string;
  sessionId: string;
  recipeId: string;
  from?: string;
  to?: string;
  mediaStreamUrl?: string;
}

export interface ProviderSessionHandle {
  provider: SessionProvider;
  externalSessionId: string;
  mediaEndpoint: string;
}

export interface InboundCall { callId: string; from: string; to: string; }

export interface Provider {
  readonly provider: SessionProvider;
  startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle>;
  stopSession(externalSessionId: string): Promise<void>;
  parseInboundWebhook(body: string | URLSearchParams | Record<string, string>): InboundCall;
  inboundResponse(mediaStreamUrl?: string): string;
}

function params(body: string | URLSearchParams | Record<string, string>): URLSearchParams {
  if (typeof body === "string") return new URLSearchParams(body);
  if (body instanceof URLSearchParams) return body;
  return formBody(body);
}

export class MockProvider implements Provider {
  readonly provider: SessionProvider = "mock";

  async startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle> {
    return { provider: this.provider, externalSessionId: `mock-${request.sessionId}`, mediaEndpoint: request.mediaStreamUrl ?? `ws://mock.local/session/${request.callId}` };
  }
  async stopSession(_externalSessionId: string): Promise<void> {}
  parseInboundWebhook(body: string | URLSearchParams | Record<string, string>): InboundCall {
    const input = params(body);
    return { callId: input.get("CallSid") ?? "mock-call", from: input.get("From") ?? "", to: input.get("To") ?? "" };
  }
  inboundResponse(mediaStreamUrl = "ws://mock.local/media"): string {
    return `<Response><Connect><Stream url="${xmlEscape(mediaStreamUrl)}" /></Connect></Response>`;
  }
}

export class LiveKitProvider extends MockProvider {
  override readonly provider: SessionProvider = "livekit";
  override async startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle> {
    return { provider: this.provider, externalSessionId: `livekit-${request.sessionId}`, mediaEndpoint: request.mediaStreamUrl ?? `wss://mock.livekit.local/room/${request.callId}` };
  }
}

interface TwilioConfig { accountSid: string; authToken: string; from: string; to: string; mediaStreamUrl: string; }

export class TwilioProvider implements Provider {
  readonly provider: SessionProvider = "twilio";
  constructor(private readonly config: TwilioConfig, private readonly fetch: Fetch = globalThis.fetch) {}

  async startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle> {
    const mediaEndpoint = request.mediaStreamUrl ?? this.config.mediaStreamUrl;
    const response = await checked(await this.fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.config.accountSid)}/Calls.json`, {
      method: "POST",
      headers: { authorization: basicAuth(this.config.accountSid, this.config.authToken), "content-type": "application/x-www-form-urlencoded" },
      body: formBody({ To: request.to ?? this.config.to, From: request.from ?? this.config.from, Twiml: this.inboundResponse(mediaEndpoint) })
    }));
    const result = await response.json() as { sid: string };
    return { provider: this.provider, externalSessionId: result.sid, mediaEndpoint };
  }
  async stopSession(externalSessionId: string): Promise<void> {
    await checked(await this.fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.config.accountSid)}/Calls/${encodeURIComponent(externalSessionId)}.json`, {
      method: "POST", headers: { authorization: basicAuth(this.config.accountSid, this.config.authToken), "content-type": "application/x-www-form-urlencoded" }, body: formBody({ Status: "completed" })
    }));
  }
  parseInboundWebhook(body: string | URLSearchParams | Record<string, string>): InboundCall {
    const input = params(body);
    return { callId: input.get("CallSid") ?? "", from: input.get("From") ?? "", to: input.get("To") ?? "" };
  }
  inboundResponse(mediaStreamUrl = this.config.mediaStreamUrl): string {
    return `<Response><Connect><Stream url="${xmlEscape(mediaStreamUrl)}" /></Connect></Response>`;
  }
}

interface ExotelConfig { accountSid: string; apiKey: string; apiToken: string; from: string; to: string; callerId: string; mediaStreamUrl: string; baseUrl?: string; }

export class ExotelProvider implements Provider {
  readonly provider: SessionProvider = "exotel";
  constructor(private readonly config: ExotelConfig, private readonly fetch: Fetch = globalThis.fetch) {}
  private get callsUrl(): string { return `${this.config.baseUrl ?? "https://api.exotel.com"}/v1/Accounts/${encodeURIComponent(this.config.accountSid)}/Calls`; }

  async startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle> {
    const mediaEndpoint = request.mediaStreamUrl ?? this.config.mediaStreamUrl;
    const response = await checked(await this.fetch(`${this.callsUrl}/connect.json`, {
      method: "POST", headers: { authorization: basicAuth(this.config.apiKey, this.config.apiToken), "content-type": "application/x-www-form-urlencoded" },
      body: formBody({ From: request.from ?? this.config.from, To: request.to ?? this.config.to, CallerId: this.config.callerId, Url: mediaEndpoint })
    }));
    const result = await response.json() as { Call?: { Sid?: string }; Sid?: string };
    const externalSessionId = result.Call?.Sid ?? result.Sid;
    if (!externalSessionId) throw new Error("Exotel response did not include a call id");
    return { provider: this.provider, externalSessionId, mediaEndpoint };
  }
  async stopSession(externalSessionId: string): Promise<void> {
    await checked(await this.fetch(`${this.callsUrl}/${encodeURIComponent(externalSessionId)}.json`, {
      method: "POST", headers: { authorization: basicAuth(this.config.apiKey, this.config.apiToken), "content-type": "application/x-www-form-urlencoded" }, body: formBody({ Status: "completed" })
    }));
  }
  parseInboundWebhook(body: string | URLSearchParams | Record<string, string>): InboundCall {
    const input = params(body);
    return { callId: input.get("CallSid") ?? input.get("CallUUID") ?? "", from: input.get("From") ?? input.get("DialWhomNumber") ?? "", to: input.get("To") ?? input.get("VirtualNumber") ?? "" };
  }
  inboundResponse(mediaStreamUrl = this.config.mediaStreamUrl): string {
    return `<Response><Connect><Stream url="${xmlEscape(mediaStreamUrl)}" /></Connect></Response>`;
  }
}
