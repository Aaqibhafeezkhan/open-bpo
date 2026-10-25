import type { SessionProvider } from "@open-bpo/core";

export interface ProviderStartRequest {
  callId: string;
  sessionId: string;
  recipeId: string;
}

export interface ProviderSessionHandle {
  provider: SessionProvider;
  externalSessionId: string;
  mediaEndpoint: string;
}

export interface Provider {
  readonly provider: SessionProvider;
  startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle>;
  stopSession(externalSessionId: string): Promise<void>;
}

export class TwilioProvider implements Provider {
  readonly provider: SessionProvider = "twilio";

  async startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle> {
    return {
      provider: this.provider,
      externalSessionId: `twilio-${request.sessionId}`,
      mediaEndpoint: `wss://mock.twilio.local/session/${request.callId}`
    };
  }

  async stopSession(_externalSessionId: string): Promise<void> {
    return;
  }
}

export class LiveKitProvider implements Provider {
  readonly provider: SessionProvider = "livekit";

  async startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle> {
    return {
      provider: this.provider,
      externalSessionId: `livekit-${request.sessionId}`,
      mediaEndpoint: `wss://mock.livekit.local/room/${request.callId}`
    };
  }

  async stopSession(_externalSessionId: string): Promise<void> {
    return;
  }
}

export class MockProvider implements Provider {
  readonly provider: SessionProvider = "mock";

  async startSession(request: ProviderStartRequest): Promise<ProviderSessionHandle> {
    return {
      provider: this.provider,
      externalSessionId: `mock-${request.sessionId}`,
      mediaEndpoint: `ws://mock.local/session/${request.callId}`
    };
  }

  async stopSession(_externalSessionId: string): Promise<void> {
    return;
  }
}

export function providerFactory(provider: SessionProvider): Provider {
  switch (provider) {
    case "twilio":
      return new TwilioProvider();
    case "livekit":
      return new LiveKitProvider();
    case "mock":
      return new MockProvider();
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
}
