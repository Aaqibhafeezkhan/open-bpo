export interface CallSummary {
  callId: string;
  direction: "inbound" | "outbound";
  durationSeconds: number;
  recipeId: string;
  createdAt: string;
  qaPercent: number | null;
  verdict: string | null;
  hasFatalErrors: boolean | null;
  latestSessionState: string | null;
}

export interface QaCallDetail {
  callId: string;
  direction: "inbound" | "outbound";
  durationSeconds: number;
  recipeId: string;
  transcript: Array<{ speaker: "caller" | "agent"; text: string; timestamp: string }>;
  createdAt: string;
  qa: null | {
    finalScore: number;
    maxPossible: number;
    qaPercent: number;
    verdict: "pass" | "warning" | "fail";
    hasFatalErrors: boolean;
    updatedAt: string;
    result: {
      breakdown: Array<{
        id: string;
        title: string;
        score: number;
        maxScore: number;
        rationale: string;
      }>;
    };
  };
}

export interface RecipeSummary {
  id: string;
  checklistPath: string;
  promptPath: string;
  toolsPath: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  maxScore: number;
  fatal: boolean;
  rule: { type: string; keywords?: string[] };
}

export interface RecipeDetail {
  id: string;
  prompt: string;
  checklist: {
    id: string;
    name: string;
    version: string;
    description: string;
    passThreshold: number;
    warningThreshold: number;
    items: ChecklistItem[];
  };
  tools: Array<{ name: string; description: string }>;
}

export interface ProviderGroup {
  id: string;
  name: string;
  providers: Array<{ id: string; name: string; configured: boolean }>;
}

export interface SessionSummary {
  sessionId: string;
  callId: string;
  provider: "twilio" | "livekit" | "mock";
  direction: "inbound" | "outbound";
  recipeId: string;
  state: "pending" | "assigned" | "active" | "completed" | "failed";
  externalSessionId: string | null;
  turns: Array<{ speaker: string; text: string }> | null;
  trace: string[] | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL === undefined
    ? "http://127.0.0.1:4017"
    : String(import.meta.env.VITE_API_BASE_URL);

export async function fetchCalls(): Promise<CallSummary[]> {
  const response = await fetch(`${API_BASE_URL}/v1/calls`);
  if (!response.ok) {
    throw new Error("Failed to load calls");
  }

  const data = (await response.json()) as { calls: CallSummary[] };
  return data.calls;
}

export async function fetchCallQa(callId: string): Promise<{ status: "pending" | "ready"; call?: QaCallDetail }> {
  const response = await fetch(`${API_BASE_URL}/v1/calls/${callId}/qa`);

  if (response.status === 202) {
    return { status: "pending" };
  }

  if (!response.ok) {
    throw new Error("Failed to load QA result");
  }

  const data = (await response.json()) as { call: QaCallDetail };
  return { status: "ready", call: data.call };
}

export async function fetchRecipes(): Promise<RecipeSummary[]> {
  const response = await fetch(`${API_BASE_URL}/v1/recipes`);
  if (!response.ok) {
    throw new Error("Failed to load recipes");
  }

  const data = (await response.json()) as { recipes: RecipeSummary[] };
  return data.recipes;
}

export async function fetchRecipe(recipeId: string): Promise<RecipeDetail> {
  const response = await fetch(`${API_BASE_URL}/v1/recipes/${encodeURIComponent(recipeId)}`);
  if (!response.ok) throw new Error("Failed to load recipe");
  const data = (await response.json()) as { recipe: RecipeDetail };
  return data.recipe;
}

export async function fetchProviderStatus(): Promise<ProviderGroup[]> {
  const response = await fetch(`${API_BASE_URL}/v1/providers/status`);
  if (!response.ok) throw new Error("Failed to load provider status");
  const data = (await response.json()) as { providers: ProviderGroup[] };
  return data.providers;
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${API_BASE_URL}/v1/sessions`);
  if (!response.ok) {
    throw new Error("Failed to load sessions");
  }

  const data = (await response.json()) as { sessions: SessionSummary[] };
  return data.sessions;
}

export async function triggerDemoCall(input: {
  direction: "inbound" | "outbound";
  recipeId: string;
  provider: "twilio" | "livekit" | "mock";
}): Promise<{ callId: string; sessionId: string | undefined }> {
  const response = await fetch(`${API_BASE_URL}/v1/demo/calls/${input.direction}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      recipeId: input.recipeId,
      provider: input.provider,
      startSession: true
    })
  });

  if (!response.ok) {
    throw new Error("Failed to trigger demo call");
  }

  const data = (await response.json()) as {
    callId: string;
    session?: { sessionId: string };
  };

  return {
    callId: data.callId,
    sessionId: data.session?.sessionId
  };
}
