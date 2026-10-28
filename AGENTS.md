# Agent guide

## Repository map

- `apps/api`: Fastify production and dependency-free demo APIs.
- `apps/web`: React and Vite operations console.
- `apps/worker`: BullMQ session and QA workers.
- `packages/core`: shared call-session contracts.
- `packages/providers`: provider boundaries and mock adapters.
- `packages/qa`: deterministic checklist loading and scoring.
- `packages/mcp`: REST-backed MCP server and transports.
- `recipes`: versioned prompt, checklist, and tool files.

## Commands

Use pnpm 10 with `COREPACK_HOME=/tmp/corepack` in constrained environments.

```bash
pnpm install
pnpm demo
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm openapi:check
```

Keep the mock demo path free of external services. Never put secrets, personal contact data, provider credentials, or media URLs in recipes, examples, fixtures, logs, or committed files.

## Adding a recipe

Create `recipes/<id>/prompt.md`, `checklist.json`, and `tools.json`. Follow `docs/RECIPE_AUTHORING.md`, use deterministic checklist rules, run the complete validation suite, and use the MCP `get_recipe` tool to verify the result.

## Adding an adapter

Implement the appropriate interface in `packages/providers`, keep the mock adapter working, report provider readiness as booleans only, and add focused tests. Do not expose configuration values through API or MCP output.

## MCP verification

Run the demo API, start `pnpm --filter @open-bpo/mcp dev`, and verify `list_recipes`, `get_recipe`, a mock `start_demo_call`, `list_calls`, and `provider_status`. Non-mock calls must stay disabled unless explicitly enabled by the operator.
