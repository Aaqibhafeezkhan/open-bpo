import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MockLanguageModelEngine, MockSpeechToTextEngine, MockTextToSpeechEngine, runVoiceSessionLoop } from "@open-bpo/core";
import { loadRecipePrompt, loadRecipeToolSpecs } from "./recipes";
import { buildTools } from "./tools";

const recipesRoot = path.resolve(import.meta.dirname, "../../../recipes");

async function tempRecipe(toolsJson: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "bpo-recipes-"));
  await mkdir(path.join(root, "r"));
  await writeFile(path.join(root, "r", "tools.json"), toolsJson);
  return root;
}

test("every shipped recipe has loadable tool specs and a prompt", async () => {
  for (const id of ["lead-qualification", "payment-reminder", "support"]) {
    const specs = await loadRecipeToolSpecs(id, recipesRoot);
    assert.ok(specs.length > 0, id);
    assert.ok(specs.every((spec) => spec.parameters), `${id} tools declare parameters`);
    assert.ok((await loadRecipePrompt(id, recipesRoot))?.length);
  }
});

test("tools come from the recipe, not a hardcoded list", async () => {
  const names = (await loadRecipeToolSpecs("support", recipesRoot)).map((spec) => spec.name);
  assert.deepEqual(names, ["ticket_lookup", "ticket_escalate"]);
});

test("invalid tools.json is rejected with a clear error", async () => {
  await assert.rejects(loadRecipeToolSpecs("r", await tempRecipe("{}")), /must be an array/);
  await assert.rejects(loadRecipeToolSpecs("r", await tempRecipe('[{"name":"a"}]')), /valid name and description/);
  await assert.rejects(loadRecipeToolSpecs("r", await tempRecipe('[{"name":"a","description":"d"},{"name":"a","description":"d"}]')), /duplicate/);
  await assert.rejects(loadRecipeToolSpecs("../x", recipesRoot), /Invalid recipe id/);
});

test("missing tools.json means no tools", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bpo-recipes-"));
  await mkdir(path.join(root, "r"));
  assert.deepEqual(await loadRecipeToolSpecs("r", root), []);
});

test("mock session end to end with a real recipe's tools", async () => {
  const tools = buildTools(await loadRecipeToolSpecs("lead-qualification", recipesRoot));
  const prompt = await loadRecipePrompt("lead-qualification", recipesRoot);
  const result = await runVoiceSessionLoop({
    userUtterances: ["Hello", "I need account help", "Please schedule callback"],
    stt: new MockSpeechToTextEngine(), tts: new MockTextToSpeechEngine(), llm: new MockLanguageModelEngine(),
    tools, ...(prompt ? { systemPrompt: prompt } : {})
  });
  assert.equal(result.finalState, "completed");
  assert.ok(result.trace.includes("tool:crm_lookup:crm_lookup_ok"));
  assert.ok(result.trace.includes("tool:schedule_callback:callback_scheduled"));
});
