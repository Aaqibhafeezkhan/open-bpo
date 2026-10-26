# Quickstart

This quickstart runs a local simulated call floor:
- inbound/outbound demo calls
- streaming mock session lifecycle
- deterministic QA scoring
- web console

## Prerequisites

- Node.js 20 or newer
- pnpm 10

## 1) Install and verify

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## 2) Start the demo

```bash
pnpm demo
```

This one command starts the API, simulated-call worker, and web console. It uses in-memory data and needs no external services or API keys. Calls begin streaming automatically.

Local endpoints:
- API: `http://127.0.0.1:4017`
- Web: `http://127.0.0.1:43123`

## 3) Trigger calls manually

```bash
curl -X POST http://127.0.0.1:4017/v1/demo/calls/inbound \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"lead-qualification","provider":"mock","startSession":true}'

curl -X POST http://127.0.0.1:4017/v1/demo/calls/outbound \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"support","provider":"mock","startSession":true}'
```

## 4) Verify call list and QA

```bash
curl http://127.0.0.1:4017/v1/calls
```

Choose a `callId` and poll QA:

```bash
curl http://127.0.0.1:4017/v1/calls/<callId>/qa
```

## 5) Verify session lifecycle

```bash
curl http://127.0.0.1:4017/v1/sessions
```

You should see `pending -> assigned -> active -> completed` transitions in session records.

## 6) Open web console

Open `http://127.0.0.1:43123`.

- Simulate inbound/outbound calls
- inspect QA breakdown
- inspect session traces

Stop the demo and all three processes with `Ctrl+C`.

## Container-backed stack

To run the Postgres and Redis-backed topology instead:

```bash
docker compose up --build
```

The database and queue are exposed locally on ports `55432` and `56379`.

## CI-friendly golden path

```bash
./scripts/demo-golden-path.sh
```

The script exits non-zero if QA is not produced in time.
