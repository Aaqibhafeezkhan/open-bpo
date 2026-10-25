import { readFile } from "node:fs/promises";
import { checklistSchema, type Checklist } from "./checklist-schema";

export async function loadChecklist(checklistPath: string): Promise<Checklist> {
  const raw = await readFile(checklistPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return checklistSchema.parse(parsed);
}
