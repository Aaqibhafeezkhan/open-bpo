import { describe, expect, it } from "vitest";
import type { Checklist } from "../src/checklist-schema";
import { scoreTranscriptAgainstChecklist } from "../src/scorer";

const checklist: Checklist = {
  id: "lead-qualification",
  name: "Lead Qualification",
  version: "1.0.0",
  description: "Checks if key qualification actions happened.",
  passThreshold: 90,
  warningThreshold: 75,
  items: [
    {
      id: "greet",
      title: "Agent greets the caller",
      maxScore: 20,
      fatal: false,
      rule: {
        type: "keyword_any",
        keywords: ["hello", "namaste"]
      }
    },
    {
      id: "budget",
      title: "Budget captured",
      maxScore: 40,
      fatal: false,
      rule: {
        type: "keyword_any",
        keywords: ["budget", "monthly spend"]
      }
    },
    {
      id: "consent",
      title: "Consent taken",
      maxScore: 1,
      fatal: true,
      rule: {
        type: "keyword_any",
        keywords: ["consent", "permission"]
      }
    }
  ]
};

describe("scoreTranscriptAgainstChecklist", () => {
  it("scores deterministic checklist and marks fatal misses", () => {
    const result = scoreTranscriptAgainstChecklist({
      checklist,
      transcript: [
        { speaker: "agent", text: "Hello!", timestamp: "2026-01-01T00:00:00.000Z" },
        { speaker: "agent", text: "What is your budget?", timestamp: "2026-01-01T00:00:01.000Z" }
      ]
    });

    expect(result.finalScore).toBe(60);
    expect(result.maxPossible).toBe(60);
    expect(result.qaPercent).toBe(100);
    expect(result.hasFatalErrors).toBe(true);
    expect(result.verdict).toBe("fail");
  });
});
