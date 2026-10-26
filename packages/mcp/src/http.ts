import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { OpenBpoClient } from "./client.js";
import { createOpenBpoMcpServer } from "./server.js";

export async function handleOpenBpoMcpHttp(input: {
  request: IncomingMessage;
  response: ServerResponse;
  body?: unknown;
  client: OpenBpoClient;
}): Promise<void> {
  const server = createOpenBpoMcpServer(input.client);
  const transport = new StreamableHTTPServerTransport({});
  await server.connect(transport);
  await transport.handleRequest(input.request, input.response, input.body);
}
