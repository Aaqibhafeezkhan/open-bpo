import { readdir } from "node:fs/promises";
import path from "node:path";

export interface RecipeSummary {
  id: string;
  checklistPath: string;
  promptPath: string;
  toolsPath: string;
}

async function resolveRecipesDir(cwd: string): Promise<string> {
  const candidates = [path.resolve(cwd, "recipes"), path.resolve(cwd, "..", "..", "recipes"), path.resolve(cwd, "..", "recipes")];

  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(`recipes directory not found from cwd=${cwd}`);
}

export async function listRecipeSummaries(cwd: string): Promise<RecipeSummary[]> {
  const recipesDir = await resolveRecipesDir(cwd);
  const entries = await readdir(recipesDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const id = entry.name;
      return {
        id,
        checklistPath: path.join("recipes", id, "checklist.json"),
        promptPath: path.join("recipes", id, "prompt.md"),
        toolsPath: path.join("recipes", id, "tools.json")
      };
    });
}
