import type { TranscriptTurn } from "@open-bpo/core";
import { checklistSchema, type Checklist, type ChecklistItem } from "./checklist-schema";

export interface ScoredChecklistItem {
  id: string;
  title: string;
  maxScore: number;
  score: number;
  fatal: boolean;
  matched: boolean;
  rationale: string;
  fatalFailed: boolean;
}

export interface ScoreResult {
  checklistId: string;
  checklistVersion: string;
  scoredAt: string;
  finalScore: number;
  maxPossible: number;
  qaPercent: number;
  verdict: "pass" | "warning" | "fail";
  hasFatalErrors: boolean;
  breakdown: ScoredChecklistItem[];
}

function normalizeTranscript(input: string | TranscriptTurn[]): string {
  if (typeof input === "string") {
    return input.toLowerCase();
  }

  return input
    .map((turn) => turn.text.trim())
    .join(" ")
    .toLowerCase();
}

function evaluateItem(item: ChecklistItem, transcript: string): { matched: boolean; rationale: string } {
  switch (item.rule.type) {
    case "keyword_any": {
      const found = item.rule.keywords.find((word) => transcript.includes(word.toLowerCase()));
      return found
        ? { matched: true, rationale: `Matched keyword: ${found}` }
        : { matched: false, rationale: `Missing any of: ${item.rule.keywords.join(", ")}` };
    }
    case "keyword_none": {
      const found = item.rule.keywords.find((word) => transcript.includes(word.toLowerCase()));
      return found
        ? { matched: false, rationale: `Forbidden keyword found: ${found}` }
        : { matched: true, rationale: "No forbidden keywords found" };
    }
    case "keyword_all": {
      const missing = item.rule.keywords.filter((word) => !transcript.includes(word.toLowerCase()));
      return missing.length === 0
        ? { matched: true, rationale: "All required keywords present" }
        : { matched: false, rationale: `Missing: ${missing.join(", ")}` };
    }
    case "regex": {
      const regex = new RegExp(item.rule.pattern, item.rule.flags);
      const matched = regex.test(transcript);
      return matched
        ? { matched: true, rationale: `Regex matched: /${item.rule.pattern}/` }
        : { matched: false, rationale: `Regex did not match: /${item.rule.pattern}/` };
    }
    case "always": {
      return item.rule.value
        ? { matched: true, rationale: "Always-pass rule" }
        : { matched: false, rationale: "Always-fail rule" };
    }
    default: {
      const exhaustive: never = item.rule;
      return exhaustive;
    }
  }
}

export function scoreTranscriptAgainstChecklist(input: {
  checklist: Checklist;
  transcript: string | TranscriptTurn[];
}): ScoreResult {
  const checklist = checklistSchema.parse(input.checklist);
  const transcript = normalizeTranscript(input.transcript);

  const breakdown = checklist.items.map((item) => {
    const evaluation = evaluateItem(item, transcript);
    const score = evaluation.matched ? item.maxScore : 0;
    const fatalFailed = item.fatal && !evaluation.matched && item.maxScore > 0;

    return {
      id: item.id,
      title: item.title,
      maxScore: item.maxScore,
      score,
      fatal: item.fatal,
      matched: evaluation.matched,
      rationale: evaluation.rationale,
      fatalFailed
    } satisfies ScoredChecklistItem;
  });

  const nonFatal = breakdown.filter((item) => !item.fatal);
  const finalScore = nonFatal.reduce((sum, item) => sum + item.score, 0);
  const maxPossible = nonFatal.reduce((sum, item) => sum + item.maxScore, 0);
  const qaPercent = maxPossible > 0 ? Number(((finalScore / maxPossible) * 100).toFixed(2)) : 0;
  const hasFatalErrors = breakdown.some((item) => item.fatalFailed);

  let verdict: ScoreResult["verdict"] = "fail";
  if (hasFatalErrors) {
    verdict = "fail";
  } else if (qaPercent >= checklist.passThreshold) {
    verdict = "pass";
  } else if (qaPercent >= checklist.warningThreshold) {
    verdict = "warning";
  } else {
    verdict = "fail";
  }

  return {
    checklistId: checklist.id,
    checklistVersion: checklist.version,
    scoredAt: new Date().toISOString(),
    finalScore,
    maxPossible,
    qaPercent,
    verdict,
    hasFatalErrors,
    breakdown
  };
}
