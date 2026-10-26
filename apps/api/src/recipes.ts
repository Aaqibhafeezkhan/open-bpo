import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export interface RecipeSummary {
  id: string;
  checklistPath: string;
  promptPath: string;
  toolsPath: string;
}

export interface RecipeDetail {
  id: string;
  prompt: string;
  checklist: unknown;
  tools: unknown;
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

export async function getRecipeDetail(cwd: string, recipeId: string): Promise<RecipeDetail | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipeId)) return null;

  const recipesDir = await resolveRecipesDir(cwd);
  const recipeDir = path.resolve(recipesDir, recipeId);
  if (path.dirname(recipeDir) !== path.resolve(recipesDir)) return null;

  try {
    const [prompt, checklistText, toolsText] = await Promise.all([
      readFile(path.join(recipeDir, "prompt.md"), "utf8"),
      readFile(path.join(recipeDir, "checklist.json"), "utf8"),
      readFile(path.join(recipeDir, "tools.json"), "utf8")
    ]);
    return {
      id: recipeId,
      prompt,
      checklist: JSON.parse(checklistText) as unknown,
      tools: JSON.parse(toolsText) as unknown
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
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
