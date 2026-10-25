import { access } from "node:fs/promises";
import path from "node:path";
import { loadChecklist, type Checklist } from "@open-bpo/qa";

const checklistCache = new Map<string, Checklist>();

async function resolveRecipesRoot(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "recipes"),
    path.resolve(process.cwd(), "..", "..", "recipes"),
    path.resolve(process.cwd(), "..", "recipes")
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to locate recipes directory from cwd=${process.cwd()}`);
}

export async function getChecklist(recipeId: string): Promise<Checklist> {
  if (checklistCache.has(recipeId)) {
    return checklistCache.get(recipeId)!;
  }

  const recipesRoot = await resolveRecipesRoot();
  const checklistPath = path.resolve(recipesRoot, recipeId, "checklist.json");
  const checklist = await loadChecklist(checklistPath);
  checklistCache.set(recipeId, checklist);
  return checklist;
}
