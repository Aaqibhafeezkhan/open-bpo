# API Reference

Base URL (local default): `http://127.0.0.1:4017`

## Authentication and browser access

Set `OPEN_BPO_API_TOKEN` to protect every `/v1/*` route and `/mcp`. Clients send `Authorization: Bearer <token>`. `/health`, `/docs/openapi.json`, and `/llms.txt` remain open. The API fails closed: with no `OPEN_BPO_API_TOKEN`, every `/v1/*` and `/mcp` request returns `503` (production mode also refuses to start). For a local, mock-only demo you can opt out with `OPEN_BPO_ALLOW_NO_AUTH=true`; `pnpm demo` and `docker compose` set it for you. Never set it on a network-reachable instance.

Browser origins are limited by `OPEN_BPO_CORS_ORIGINS`, a comma-separated list. Its default permits the local web console at `http://localhost:43123` and `http://127.0.0.1:43123`. The web app can send the bearer header through `VITE_API_TOKEN`.

The generated OpenAPI document is available at `GET /docs/openapi.json` and committed at `docs/openapi.json`.

## MCP

`POST /mcp`, `GET /mcp`, and `DELETE /mcp` expose the stateless streamable HTTP MCP transport. When API auth is enabled, use the same bearer token. See [MCP.md](MCP.md) for stdio and remote client configuration.

## Health

### `GET /health`

Returns service liveness.

Response:

```json
{ "status": "ok", "service": "open-bpo-api" }
```

---

## Recipes

### `GET /v1/recipes`

Lists recipe directories discovered under `recipes/`.

Response:

```json
{
  "recipes": [
    {
      "id": "lead-qualification",
      "checklistPath": "recipes/lead-qualification/checklist.json",
      "promptPath": "recipes/lead-qualification/prompt.md",
      "toolsPath": "recipes/lead-qualification/tools.json"
    }
  ]
}
```

### `GET /v1/recipes/:recipeId`

Returns the read-only prompt text, parsed checklist, and parsed tools for one recipe. Unknown or invalid recipe IDs return `404`; IDs are validated before any filesystem access.

Response:

```json
{
  "recipe": {
    "id": "lead-qualification",
    "prompt": "# Lead Qualification Agent Prompt...",
    "checklist": { "id": "lead-qualification", "items": [] },
    "tools": []
  }
}
```

---

## Provider status

### `GET /v1/providers/status`

Returns provider configuration status grouped by category. The response contains names and booleans only; it never exposes environment values.

```json
{
  "providers": [
    {
      "id": "phone",
      "name": "Phone line",
      "providers": [{ "id": "mock", "name": "Mock", "configured": true }]
    }
  ]
}
```

---

## Calls and QA

### `POST /v1/webhooks/call-ended`

Ingest a call-ended event and enqueue QA scoring.

Request body:

```json
{
  "callId": "demo-call-001",
  "direction": "inbound",
  "duration": 242,
  "recipeId": "lead-qualification",
  "startSession": false,
  "provider": "mock",
  "transcript": [
    { "speaker": "agent", "text": "Hello", "timestamp": "2026-10-25T10:00:00.000Z" },
    { "speaker": "caller", "text": "Need voice AI", "timestamp": "2026-10-25T10:00:03.000Z" }
  ]
}
```

Response (`202`):

```json
{
  "status": "queued",
  "callId": "demo-call-001",
  "qaJobId": "1",
  "session": null
}
```

### `GET /v1/calls`

Returns recent calls and scoring/session summary fields.

### `GET /v1/calls/:callId/qa`

Returns:
- `202` + `{ "status": "pending" }` while scoring is in progress
- `200` + full call + QA payload once available
- `404` if call id is unknown

---

## Session loop

### `POST /v1/sessions`

Queue a mock live session job.

Request body:

```json
{
  "callId": "demo-call-001",
  "direction": "inbound",
  "provider": "mock",
  "recipeId": "lead-qualification",
  "seedUtterances": ["Hello", "Need account help"]
}
```

Response (`202`):

```json
{
  "status": "queued",
  "sessionId": "d8f...",
  "jobId": "7"
}
```

### `GET /v1/sessions`

Lists recent session records including state, trace, and errors.

### `GET /v1/sessions/:sessionId`

Returns one session record.

---

## Demo automation endpoints

### `POST /v1/demo/calls/inbound`
### `POST /v1/demo/calls/outbound`

Create a sample call (plus optional session) without external dependencies.

Request body:

```json
{
  "recipeId": "lead-qualification",
  "provider": "mock",
  "startSession": true
}
```

Response (`202`):

```json
{
  "status": "queued",
  "callId": "inbound-176138...",
  "direction": "inbound",
  "qaJobId": "9",
  "session": {
    "sessionId": "a1b2...",
    "jobId": "10"
  }
}
```
