import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { ToolSpec } from "@open-bpo/core";
import { loadChecklist, type Checklist } from "@open-bpo/qa";

const checklistCache = new Map<string, Checklist>();

export async function resolveRecipesRoot(): Promise<string> {
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

/** Reads `prompt.md` for a recipe; returns undefined when the recipe has none. */
export async function loadRecipePrompt(recipeId: string, recipesRoot?: string): Promise<string | undefined> {
  const root = recipesRoot ?? await resolveRecipesRoot();
  try {
    return await readFile(path.resolve(root, safeRecipeId(recipeId), "prompt.md"), "utf8");
  } catch {
    return undefined;
  }
}

/** Reads and validates the tool definitions in a recipe's `tools.json`. */
export async function loadRecipeToolSpecs(recipeId: string, recipesRoot?: string): Promise<ToolSpec[]> {
  const root = recipesRoot ?? await resolveRecipesRoot();
  const file = path.resolve(root, safeRecipeId(recipeId), "tools.json");
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error(`Invalid tools.json for recipe "${recipeId}": ${error instanceof Error ? error.message : "unreadable"}`);
  }
  if (!Array.isArray(raw)) throw new Error(`tools.json for recipe "${recipeId}" must be an array`);
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const item = entry as Partial<ToolSpec> | null;
    if (!item || typeof item.name !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.name) || typeof item.description !== "string") {
      throw new Error(`tools.json for recipe "${recipeId}": entry ${index} needs a valid name and description`);
    }
    if (seen.has(item.name)) throw new Error(`tools.json for recipe "${recipeId}": duplicate tool "${item.name}"`);
    seen.add(item.name);
    if (item.parameters !== undefined && (typeof item.parameters !== "object" || item.parameters === null || Array.isArray(item.parameters))) {
      throw new Error(`tools.json for recipe "${recipeId}": tool "${item.name}" parameters must be a JSON Schema object`);
    }
    return { name: item.name, description: item.description, ...(item.parameters ? { parameters: item.parameters } : {}) };
  });
}

function safeRecipeId(recipeId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(recipeId)) throw new Error(`Invalid recipe id "${recipeId}"`);
  return recipeId;
}
