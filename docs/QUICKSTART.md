# Quickstart (zero paid keys)

This quickstart runs a full local mock deployment:
- inbound/outbound demo calls
- live mock session lifecycle
- deterministic QA scoring
- web console

## Prerequisites

- Docker + Docker Compose v2

## 1) Boot stack

```bash
docker compose up --build
```

Local endpoints:
- API: `http://127.0.0.1:4017`
- Web: `http://127.0.0.1:43123`
- Postgres: `127.0.0.1:55432`
- Redis: `127.0.0.1:56379`

## 2) Trigger inbound and outbound demo calls

```bash
curl -X POST http://127.0.0.1:4017/v1/demo/calls/inbound \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"lead-qualification","provider":"mock","startSession":true}'

curl -X POST http://127.0.0.1:4017/v1/demo/calls/outbound \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"support","provider":"mock","startSession":true}'
```

## 3) Verify call list and QA

```bash
curl http://127.0.0.1:4017/v1/calls
```

Choose a `callId` and poll QA:

```bash
curl http://127.0.0.1:4017/v1/calls/<callId>/qa
```

## 4) Verify session lifecycle

```bash
curl http://127.0.0.1:4017/v1/sessions
```

You should see `pending -> assigned -> active -> completed` transitions in session records.

## 5) Open web console

Open `http://127.0.0.1:43123`.

- Simulate inbound/outbound calls
- inspect QA breakdown
- inspect session traces

## 6) CI-friendly golden path

```bash
./scripts/demo-golden-path.sh
```

The script exits non-zero if QA is not produced in time.
