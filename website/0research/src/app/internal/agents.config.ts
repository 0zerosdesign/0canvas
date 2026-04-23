import { STYLE_GUIDE } from "./agent";

export interface AgentConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPromptTemplate: string;
  outputSchemaType: "directus_feed" | "markdown" | "none";
  knowledgeBase?: "ux-bites";
  suggestions: string[];
}

export const AGENTS: AgentConfig[] = [
  {
    id: "shots",
    name: "Shots",
    icon: "📷",
    description: "Generate UX Shot content from AI app screenshots",
    systemPromptTemplate: STYLE_GUIDE,
    outputSchemaType: "directus_feed",
    knowledgeBase: "ux-bites",
    suggestions: [
      "Analyze this AI chat interface",
      "Break down this onboarding flow",
      "Review this AI settings page",
      "Decode this prompt input design",
    ],
  },
];

export function getAgent(id: string): AgentConfig | undefined {
  return AGENTS.find((a) => a.id === id);
}
