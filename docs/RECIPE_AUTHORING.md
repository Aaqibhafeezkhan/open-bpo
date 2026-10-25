# Recipe Authoring Guide

Recipes define agent behavior and QA scoring targets. Each recipe lives under:

```text
recipes/<recipe-id>/
  prompt.md
  tools.json
  checklist.json
```

## 1) `prompt.md`

Human-readable prompt policy for the agent persona and call objective.

Recommended sections:
- role
- goals
- guardrails
- escalation behavior
- tone and language constraints

## 2) `tools.json`

A list of tool descriptors available for the session loop.

Example:

```json
[
  {
    "name": "crm_lookup",
    "description": "Fetch known lead metadata by phone number"
  }
]
```

## 3) `checklist.json`

Defines deterministic QA scoring.

### Supported rule types

- `keyword_any` — pass when at least one keyword appears
- `keyword_all` — pass when all keywords appear
- `keyword_none` — pass when none of the keywords appear
- `regex` — pass when regex matches transcript text
- `always` — constant pass/fail guard for testing

### Field reference

- `id`, `name`, `version`, `description`
- `passThreshold` (default 90)
- `warningThreshold` (default 75)
- `items[]`:
  - `id`
  - `title`
  - `maxScore`
  - `fatal`
  - `rule`

### Fatal rule behavior

Fatal checklist items are excluded from percentage denominator and instead act as hard fail gates.
If a fatal rule fails and has `maxScore > 0`, overall verdict is `fail` regardless of percentage.

## 4) Validation and test workflow

1. Create/update recipe JSON.
2. Run `pnpm test` to validate scorer behavior.
3. Use `POST /v1/demo/calls/inbound` with your recipe to verify end-to-end output.
4. Review QA breakdown in web console.
