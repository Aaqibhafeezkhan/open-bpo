# Public OSS checklist (v0.1.0-ready)

## Release target

- Candidate tag: `v0.1.0`
- Status: **ready for technical preview**, pending mirror admin actions below.

## Completed in this repository

- [x] Apache-2.0 `LICENSE`
- [x] Root README with 15-minute quickstart and copy/paste commands
- [x] `docs/QUICKSTART.md` with webhook -> QA retrieval flow
- [x] `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- [x] `.env.example` without secrets
- [x] Docker Compose one-command stack (api + worker + web + redis + postgres)
- [x] Mock provider path (no API keys required)
- [x] QA checklist schema + deterministic scorer + unit test
- [x] Trademark notice included
- [x] Public-safe recipe examples (lead qualification + support)
- [x] Golden path validated via `./scripts/demo-golden-path.sh` on live stack
- [x] `.github/ISSUE_TEMPLATE/` with bug/feature templates + config
- [x] `.github/PULL_REQUEST_TEMPLATE.md`
- [x] `.github/workflows/ci.yml` for push/PR (fork-safe, no secrets required)
- [x] `SECURITY.md` includes GitHub Security Advisories guidance + private email contact

## Remaining blockers before public GitHub mirror

These are operational/legal publication steps outside code correctness:

1. **Public mirror publication**
   - Create public repository in target GitHub org.
   - Push tag and default branch to public mirror.
2. **Repository governance setup**
   - Enable branch protection rules in GitHub UI.
   - Enable private vulnerability reporting in GitHub Security UI.
3. **Legal review checkpoint**
   - Final legal confirmation for trademark usage phrasing and NOTICE requirements.
4. **CI runner setup**
   - Optional: attach secrets for future non-mock integration tests.
   - Current CI already supports fork PRs with zero secrets in mock-first mode.

## Versioning note

This scaffold is intentionally minimal and mock-first. Real telephony/media integrations are expected in follow-up releases.
