import { describe, expect, it } from "vitest";
import leadQualification from "../../../recipes/lead-qualification/checklist.json";
import paymentReminder from "../../../recipes/payment-reminder/checklist.json";
import support from "../../../recipes/support/checklist.json";
import { checklistSchema } from "../src/checklist-schema";

const recipes = [
  ["lead-qualification", leadQualification],
  ["payment-reminder", paymentReminder],
  ["support-resolution", support]
] as const;

describe.each(recipes)("%s recipe", (expectedId, checklist) => {
  it("has a valid checklist", () => {
    const parsed = checklistSchema.parse(checklist);

    expect(parsed.id).toBe(expectedId);
    expect(parsed.items.some((item) => !item.fatal && item.maxScore > 0)).toBe(true);
  });
});
