# Deploying open-bpo for a small commercial operation

This guide explains how to evolve the local stack into a small paid deployment
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
- `DATABASE_URL`
- `REDIS_URL`
- `API_PORT`
- `RECIPE_ID`
- `VITE_API_BASE_URL`

Recommended additions for production hardening:
- `NODE_ENV=production`
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
- billing/metering
- secure provider credential vaulting

## 5. Commercial packaging guidance (what to charge for)

The OSS core is free. Service businesses can charge for:
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
5. Offer managed plans on top of this OSS base.
