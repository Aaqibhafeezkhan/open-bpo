import type { TranscriptTurn } from "@open-bpo/core";

export function buildDemoTranscript(direction: "inbound" | "outbound", recipeId: string): TranscriptTurn[] {
  const now = new Date().toISOString();

  if (recipeId === "support") {
    return direction === "inbound"
      ? [
          { speaker: "caller", text: "Hello, our dashboard is down since morning.", timestamp: now },
          { speaker: "agent", text: "I understand your issue and I will help immediately.", timestamp: now },
          { speaker: "agent", text: "Next step is escalation and we will follow up within two hours.", timestamp: now }
        ]
      : [
          { speaker: "agent", text: "Hi, this is support follow-up about your pending ticket.", timestamp: now },
          { speaker: "caller", text: "Yes, please share the next step.", timestamp: now },
          { speaker: "agent", text: "I will resolve this and follow up by today evening.", timestamp: now }
        ];
  }

  return direction === "inbound"
    ? [
        { speaker: "caller", text: "Hi, we need AI calls for lead qualification.", timestamp: now },
        { speaker: "agent", text: "Hello and namaste. What requirement and use case do you have?", timestamp: now },
        { speaker: "caller", text: "Inbound support and outbound sales follow-up.", timestamp: now },
        { speaker: "agent", text: "What monthly budget and timeline are you planning? Callback okay with consent?", timestamp: now },
        { speaker: "caller", text: "We get about 500 calls a day, timeline next month, callback consent yes.", timestamp: now }
      ]
    : [
        { speaker: "agent", text: "Hello and namaste, I am calling from the AI onboarding team.", timestamp: now },
        { speaker: "caller", text: "Sure, please continue.", timestamp: now },
        { speaker: "agent", text: "Can I understand your requirement and expected monthly budget?", timestamp: now },
        { speaker: "caller", text: "Need voice QA for 50 agents across two shifts.", timestamp: now },
        { speaker: "agent", text: "Great, can we schedule a callback with your consent tomorrow?", timestamp: now },
        { speaker: "caller", text: "Yes, callback consent confirmed.", timestamp: now }
      ];
}
