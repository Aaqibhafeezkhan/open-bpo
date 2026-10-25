# Security Policy

## Supported versions

This repository is currently in active development. The `main` branch is the
supported line for security updates until tagged releases begin.

## Reporting a vulnerability

Please do **not** open public issues for security vulnerabilities.

Report privately to: **security@qualiabits.com**

Include:
- affected component (`apps/api`, `apps/worker`, package name)
- reproduction steps
- impact assessment
- suggested fix (if available)

We will acknowledge reports, triage severity, and provide a remediation timeline.

## GitHub Security Advisories

When this code is mirrored to public GitHub, maintainers should enable GitHub
private vulnerability reporting and triage reports through GitHub Security
Advisories as an additional intake path. Until then, email
**security@qualiabits.com** remains the authoritative reporting channel.

## Security constraints for contributors

- Never commit API keys, credentials, tokens, or private certificates.
- Never commit customer PII, recordings, or transcripts from production systems.
- Keep `.env.example` generic and non-secret.
- If adding integrations, provide mock/local fallback paths for development.
