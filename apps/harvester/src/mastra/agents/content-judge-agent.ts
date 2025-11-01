import { contentJudgePrompt } from "@lib/prompts/content-judge-prompt";
import { Agent } from "@mastra/core/agent";
import {
  createAnswerRelevancyScorer,
  createHallucinationScorer,
} from "@mastra/evals/scorers/llm";

export const contentJudgeAgent = new Agent({
  name: "content-judge-agent",
  description:
    "Analyzes content summaries to identify, score, and rank key topics by significance, providing structured guidance for email content curation.",
  instructions: contentJudgePrompt,
  model: "anthropic/claude-sonnet-4-5",
  tools: {},
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({
        model: "google/gemini-2.5-flash-lite",
      }),
      sampling: { type: "ratio", rate: 1 },
    },
    hallucination: {
      scorer: createHallucinationScorer({
        model: "google/gemini-2.5-flash-lite",
      }),
      sampling: { type: "ratio", rate: 1 },
    },
  },
});
