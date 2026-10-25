# Contributing to open-bpo

Thanks for helping build open-bpo.

## First-time setup

```bash
pnpm install
pnpm typecheck
pnpm test
```

To run full local stack:

```bash
docker compose up --build
```

## Development principles

1. **Public-safe only**
   - Do not commit customer data, recordings, or private prompts.
   - Do not commit credentials or secrets.
2. **Contract stability**
   - Keep API and queue payload changes backwards-compatible when possible.
3. **Mock path reliability**
   - Local no-key demo flow must remain operational.

## Required checks before submitting

```bash
pnpm typecheck
pnpm test
./scripts/demo-golden-path.sh
```

## Areas to contribute

- provider adapters (Twilio/LiveKit/SIP)
- richer recipe packs and QA rubrics
- observability and metrics
- auth/tenant boundary hardening

## Reporting security concerns

Please follow [SECURITY.md](SECURITY.md) instead of opening public vulnerabilities.
