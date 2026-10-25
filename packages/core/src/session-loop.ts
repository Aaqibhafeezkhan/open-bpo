import type { AgentTool, VoiceSessionResult, VoiceTurn } from "./types";

export interface SpeechToTextEngine {
  transcribe(chunk: string): Promise<string>;
}

export interface LanguageModelEngine {
  respond(input: string): Promise<string>;
}

export interface TextToSpeechEngine {
  synthesize(text: string): Promise<string>;
}

export class MockSpeechToTextEngine implements SpeechToTextEngine {
  async transcribe(chunk: string): Promise<string> {
    return chunk.trim();
  }
}

export class MockLanguageModelEngine implements LanguageModelEngine {
  async respond(input: string): Promise<string> {
    const normalized = input.toLowerCase();
    if (normalized.includes("budget")) {
      return "Great, sharing pricing bands. What monthly budget range is comfortable for you?";
    }

    if (normalized.includes("demo") || normalized.includes("callback")) {
      return "Noted. I can schedule a callback with a specialist. What date works for you?";
    }

    return "Understood. Let me capture that and ask one more qualifying question.";
  }
}

export class MockTextToSpeechEngine implements TextToSpeechEngine {
  async synthesize(text: string): Promise<string> {
    return text;
  }
}

export async function runVoiceSessionLoop(input: {
  userUtterances: string[];
  stt: SpeechToTextEngine;
  llm: LanguageModelEngine;
  tts: TextToSpeechEngine;
  tools: AgentTool[];
}): Promise<VoiceSessionResult> {
  const turns: VoiceTurn[] = [];
  const trace: string[] = [];

  for (const utterance of input.userUtterances) {
    const text = await input.stt.transcribe(utterance);
    turns.push({ speaker: "caller", text });
    trace.push(`caller:${text}`);

    for (const tool of input.tools) {
      if (text.toLowerCase().includes(tool.name.toLowerCase())) {
        const toolOutput = await tool.run(text);
        trace.push(`tool:${tool.name}:${toolOutput}`);
      }
    }

    const response = await input.llm.respond(text);
    const spoken = await input.tts.synthesize(response);
    turns.push({ speaker: "agent", text: spoken });
    trace.push(`agent:${spoken}`);
  }

  return {
    finalState: "completed",
    turns,
    trace
  };
}
