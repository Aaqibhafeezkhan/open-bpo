# Deploying open-bpo for a small commercial operation

This guide explains how to evolve the local stack into a small production deployment
for agencies or BPO operators.

## 1. Baseline topology

Start from the same components:
- `apps/api`
- `apps/worker`
- Redis
- Postgres
- `apps/web`

For production, split into dedicated services behind a reverse proxy.

## 2. Environment requirements

Minimum environment settings:
- `OPEN_BPO_API_TOKEN` (required; without it the API answers 503 on `/v1/*` and `/mcp`)
- `DATABASE_URL`
- `REDIS_URL`
- `API_PORT`
- `RECIPE_ID`
- `VITE_API_BASE_URL`

Recommended additions for production hardening:
- `NODE_ENV=production`
- `TELEPHONY_PROVIDER` set only to a real adapter (`twilio` or `exotel`); `livekit` is not implemented and is rejected
- explicit CORS origin allowlist
- structured logging sink (Loki/ELK/Datadog)
- TLS termination at ingress/load balancer

## 3. Scale notes

### API
- Stateless: scale horizontally behind load balancer.
- Keep request validation strict.

### Worker
- Scale by queue throughput.
- Separate QA and session workers if traffic grows.

### Redis
- Use managed Redis or persistence-enabled self-hosting.
- Monitor memory and queue latency.

### Postgres
- Add backups + point-in-time recovery.
- Add read replica if dashboard/query load increases.

## 4. Multi-tenant readiness gaps (still to build)

- Auth + RBAC
- tenant isolation at DB and queue level
- usage metering
- secure provider credential vaulting

## 5. Extension areas

Service teams commonly extend the core with:
- deployment + infrastructure management
- recipe/checklist customization per process
- provider integration work (Twilio/LiveKit/SIP trunks)
- QA analytics and operations tuning
- SLA-based support and maintenance

## 6. Suggested rollout path

1. Pilot on one campaign with mock provider + synthetic traffic.
2. Add real provider adapters under `packages/providers`.
3. Introduce auth and tenant boundaries.
4. Add observability, runbooks, and incident workflow.
5. Add an operational support layer on top of this OSS base.
