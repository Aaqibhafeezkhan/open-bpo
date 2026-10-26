# Use open-bpo with MCP clients

Start the local API with `pnpm demo`, or run only the demo API with `pnpm --filter @open-bpo/api demo`. The stdio server connects to `http://127.0.0.1:4017` by default.

## Cursor

Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "open-bpo": {
      "command": "npx",
      "args": ["-y", "@open-bpo/mcp"],
      "env": { "OPEN_BPO_API_URL": "http://127.0.0.1:4017" }
    }
  }
}
```

Cursor also supports MCP installation deeplinks using the `cursor://anysphere.cursor-deeplink/mcp/install` scheme. Review the generated configuration before accepting a deeplink.

## Claude Desktop

Add this entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "open-bpo": {
      "command": "npx",
      "args": ["-y", "@open-bpo/mcp"],
      "env": { "OPEN_BPO_API_URL": "http://127.0.0.1:4017" }
    }
  }
}
```

If API auth is enabled, add `OPEN_BPO_TOKEN` to the `env` object.

## Remote streamable HTTP

The API exposes `POST`, `GET`, and `DELETE` at `/mcp`. Configure a remote MCP client with:

```json
{
  "mcpServers": {
    "open-bpo": {
      "url": "https://YOUR-HOST/mcp",
      "headers": { "Authorization": "Bearer ${OPEN_BPO_TOKEN}" }
    }
  }
}
```

Keep the bearer token in the client secret store, not in a committed file.

## Grok Bot

Add a remote MCP connector using `https://YOUR-HOST/mcp` and a bearer token. For a bot running on the same machine as open-bpo, use the stdio configuration above instead. Start with `list_recipes`, use only the mock provider for `start_demo_call`, and inspect outcomes with `list_calls`, `get_call_qa`, and `qa_summary`.

## Privacy controls

Set `OPEN_BPO_REDACT=1` on the MCP process to mask email-like and phone-number-like text in tool and resource output. Non-mock calls are refused unless `OPEN_BPO_ALLOW_REAL_CALLS=1` is explicitly set.
