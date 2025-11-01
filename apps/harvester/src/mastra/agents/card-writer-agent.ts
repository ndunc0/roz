import { cardWriterPrompt } from "@lib/prompts/card-writer-prompt";
import { Agent } from "@mastra/core/agent";
import {
  createAnswerRelevancyScorer,
  createHallucinationScorer,
} from "@mastra/evals/scorers/llm";

export const cardWriterAgent = new Agent({
  name: "card-writer-agent",
  description:
    "Transforms curated topics into a polished weekly digest card with a headline and 1-6 bullet points (typically 3), ensuring strict character limits and structured output. The agent decides bullet count based on week activity.",
  instructions: cardWriterPrompt,
  model: "anthropic/claude-sonnet-4-5",
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
