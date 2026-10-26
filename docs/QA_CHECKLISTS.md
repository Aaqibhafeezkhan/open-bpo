# QA checklist examples

QA is deterministic: each recipe supplies `checklist.json`, and the scorer evaluates the normalized transcript without an LLM. This makes a result reproducible and keeps the local path key-free.

## Included checklists

| Recipe | What it checks | Fatal gate |
| --- | --- | --- |
| [Lead qualification](../recipes/lead-qualification/checklist.json) | greeting, discovery, budget, timeline, recap | callback consent |
| [Support](../recipes/support/checklist.json) | issue confirmation, ownership, next step | prohibited abusive language |
| [Payment reminder](../recipes/payment-reminder/checklist.json) | identity-safe opening, amount/due date, next step, recap | sensitive-data request or coercive language |

## Scored item example

```json
{
  "id": "due-date",
  "title": "Agent states the due date",
  "maxScore": 20,
  "fatal": false,
  "rule": {
    "type": "keyword_any",
    "keywords": ["due date", "due on", "pay by"]
  }
}
```

Matched non-fatal items add `maxScore` to the numerator. Unmatched items add zero. Fatal items are excluded from the percentage and act as hard gates.

## Fatal safety example

```json
{
  "id": "no-sensitive-data",
  "title": "Agent does not request sensitive payment credentials",
  "maxScore": 1,
  "fatal": true,
  "rule": {
    "type": "keyword_none",
    "keywords": ["tell me your cvv", "share your pin", "read your otp"]
  }
}
```

If a forbidden phrase appears, the result fails even when every scored item passes. Keyword rules are substring matches, so use specific phrases and test both passing and failing transcripts. See [Recipe authoring](RECIPE_AUTHORING.md) for all rule types.
