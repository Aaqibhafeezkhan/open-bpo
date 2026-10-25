import { z } from "zod";

const checklistRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("keyword_any"),
    keywords: z.array(z.string().min(1)).min(1)
  }),
  z.object({
    type: z.literal("keyword_none"),
    keywords: z.array(z.string().min(1)).min(1)
  }),
  z.object({
    type: z.literal("keyword_all"),
    keywords: z.array(z.string().min(1)).min(1)
  }),
  z.object({
    type: z.literal("regex"),
    pattern: z.string().min(1),
    flags: z.string().optional()
  }),
  z.object({
    type: z.literal("always"),
    value: z.boolean()
  })
]);

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  maxScore: z.number().int().min(0),
  fatal: z.boolean().default(false),
  rule: checklistRuleSchema
});

export const checklistSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  passThreshold: z.number().min(0).max(100).default(90),
  warningThreshold: z.number().min(0).max(100).default(75),
  items: z.array(checklistItemSchema).min(1)
});

export type Checklist = z.infer<typeof checklistSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
