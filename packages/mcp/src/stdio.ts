#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OpenBpoClient } from "./client.js";
import { createOpenBpoMcpServer } from "./server.js";

const client = new OpenBpoClient({ baseUrl: process.env.OPEN_BPO_API_URL, token: process.env.OPEN_BPO_TOKEN });
const server = createOpenBpoMcpServer(client);
await server.connect(new StdioServerTransport());
