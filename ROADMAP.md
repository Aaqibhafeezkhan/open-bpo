# Roadmap

open-bpo is a small, runnable reference stack first. Roadmap items should preserve the no-key mock path and avoid customer data, credentials, or private prompts.

## Good first issue ideas

These are intentionally scoped so a new contributor can turn one item into one issue and one pull request.

1. Add unit tests for `keyword_any` checklist rules with mixed-case transcripts.
2. Add unit tests for `keyword_all` rules that report every missing keyword.
3. Add unit tests for `keyword_none` fatal-rule behavior.
4. Add unit tests for regex rules with and without flags.
5. Validate that checklist `warningThreshold` does not exceed `passThreshold`.
6. Add a CLI command that validates every recipe directory.
7. Sort recipe IDs in the `/v1/recipes` response.
8. Add an empty-state explanation to the calls table.
9. Add a copy button for call and session IDs in the console.
10. Add a recipe filter to the calls view.
11. Show checklist version in the QA detail panel.
12. Add loading skeletons to the console panels.
13. Add an accessible label and focus state to every console control.
14. Document how to change the default API and web ports.
15. Add a mock transcript fixture for the support recipe.
16. Add a mock transcript fixture for the payment-reminder recipe.
17. Add a recipe template directory with annotated placeholder files.
18. Add a health check for the web service in Docker Compose.
19. Add graceful shutdown handling to the API process.
20. Add graceful shutdown handling to both BullMQ workers.

## Next

- Contract tests for API routes and queue payloads
- Provider adapter examples backed by local fakes
- Recipe validation in CI
- OpenTelemetry traces across API, queue, worker, and database
- Authentication and tenant-boundary reference implementation
- Postgres migrations and documented upgrade/rollback flow
- Retry, dead-letter, and replay tools for failed jobs
- Browser tests for the golden path

## Later

- Real-time media bridge reference implementation
- Human handoff and supervisor intervention contracts
- Versioned recipe registry and evaluation datasets
- Kubernetes deployment example with production security notes
- Retention controls for transcripts and call metadata

Roadmap entries are direction, not release commitments. Open a feature request before starting a cross-package change.
