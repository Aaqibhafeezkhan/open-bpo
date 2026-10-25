# Contributing to open-bpo

Thanks for contributing.

## Principles

1. **Public-safe code only**: do not commit customer data, credentials, or private tenant prompts.
2. **Contract-first changes**: preserve API and queue compatibility where possible.
3. **Mock-path stability**: local no-credential flow must keep working.

## Setup

```bash
pnpm install
pnpm typecheck
pnpm test
```

## Coding guidelines

- TypeScript first for API/package boundaries.
- Add tests for scorer or state-machine behavior when changing logic.
- Keep provider integrations behind interfaces (`packages/providers`).

## Commit conventions

Use descriptive commits grouped by logical feature or fix.

## Security notes

- Never hardcode API keys, tokens, or account identifiers.
- Keep `.env.example` generic.
- Validate and sanitize all external webhook payloads.
