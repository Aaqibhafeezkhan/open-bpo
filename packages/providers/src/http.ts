export type Fetch = typeof fetch;

export async function checked(response: Response): Promise<Response> {
  if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
  return response;
}

export function formBody(values: Record<string, string>): URLSearchParams {
  return new URLSearchParams(values);
}

export function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[character] ?? character);
}

export function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}
