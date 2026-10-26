export interface OpenBpoClientOptions {
  baseUrl?: string | undefined;
  token?: string | undefined;
  fetch?: typeof fetch | undefined;
}

export class OpenBpoClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly fetcher: typeof fetch;

  constructor(options: OpenBpoClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:4017").replace(/\/$/, "");
    this.token = options.token;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async get<T>(path: string): Promise<{ status: number; data: T }> {
    return this.request<T>(path, { method: "GET" });
  }

  async post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
    return this.request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<{ status: number; data: T }> {
    const headers = new Headers(init.headers);
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    const response = await this.fetcher(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok && response.status !== 202) {
      throw new Error(`open-bpo API request failed with status ${response.status}`);
    }
    return { status: response.status, data: (await response.json()) as T };
  }
}
