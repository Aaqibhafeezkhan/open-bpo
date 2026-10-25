# open-bpo

> **Deploy an AI BPO floor in one afternoon.**

open-bpo is Qualia Technologies' open-source AI BPO scaffold for teams who want to self-host:
- mockable voice agent sessions
- deterministic BYO-checklist QA
- runnable local operations stack (API + worker + web + Redis + Postgres)

No paid API keys are required for the default demo path.

---

## Architecture at a glance

```text
Webhook/Demo calls -> API -> Redis queue -> Worker -> Postgres -> Web console/API
                               ^                               |
                               +----- sessions + QA ----------+
```

For the full diagram and boundaries, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 15-minute quickstart (copy/paste)

```bash
git clone <your-repo-url> open-bpo
cd open-bpo
docker compose up --build
```

Then in another terminal:

```bash
curl -X POST http://127.0.0.1:4017/v1/demo/calls/inbound \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"lead-qualification","provider":"mock","startSession":true}'
```

Fetch calls and QA:

```bash
curl http://127.0.0.1:4017/v1/calls
curl http://127.0.0.1:4017/v1/calls/<callId>/qa
curl http://127.0.0.1:4017/v1/sessions
```

Open the console:

- http://127.0.0.1:43123

See full walkthrough: [docs/QUICKSTART.md](docs/QUICKSTART.md)

---

## Golden path script (CI-friendly)

```bash
./scripts/demo-golden-path.sh
```

This script:
1. Creates a demo call via API
2. Polls until QA result is ready
3. Prints structured output
4. Exits non-zero if the flow fails

---

## Demo UX notes

The console provides:
- inbound/outbound simulation controls
- call list with QA/session status
- QA verdict + per-checklist breakdown
- live session state and execution trace

If you want sample data for screenshots/live demos:

```bash
./scripts/seed-sample-data.sh
```

---

## Repository structure

```text
apps/
  api/       Fastify API
  worker/    BullMQ consumers (QA + session loop)
  web/       React/Vite operations console
packages/
  core/      shared session/call models and loop primitives
  providers/ provider interfaces and stubs
  qa/        checklist schema + deterministic scorer + tests
recipes/
  lead-qualification/
  support/
deploy/compose/
docs/
scripts/
```

---

## Documentation index

- [docs/QUICKSTART.md](docs/QUICKSTART.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- [docs/RECIPE_AUTHORING.md](docs/RECIPE_AUTHORING.md)
- [docs/DEPLOY.md](docs/DEPLOY.md)
- [docs/PUBLIC_CHECKLIST.md](docs/PUBLIC_CHECKLIST.md)
- [SECURITY.md](SECURITY.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## Public-safety guarantees

- No customer PII/audio fixtures
- No customer secrets or API keys
- No private tenant prompt packs
- `.env.example` provides non-secret defaults only

---

## Trademark notice

Qualia, CallPulse, and QualiaBits are trademarks of their respective owners.
This OSS project is separate from the commercial Qualia Cloud platform.

## License

Apache-2.0 (`LICENSE`)
