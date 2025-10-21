import { blogSummaryPrompt } from "@lib/prompts/blog-summary-prompt";
import { Agent } from "@mastra/core/agent";
import { stagehandHarvestRecentPostsTool } from "@mastra/tools/blog/stagehand-harvest-recent-posts";
import {
  createAnswerRelevancyScorer,
  createHallucinationScorer,
} from "@mastra/evals/scorers/llm";

export const blogPostSummarizerAgent = new Agent({
  name: "blog-post-summarizer-agent",
  description:
    "Summarizes recent blog posts into concise overviews highlighting key points for busy readers.",
  instructions: blogSummaryPrompt,
  model: "google/gemini-2.5-flash-lite", // TODO: maybe actually update THIS one to Sonnet 4.5 (or Haiku 4.5)
  tools: {
    stagehandHarvestRecentPosts: stagehandHarvestRecentPostsTool,
  },
  scorers: {
    relevancy: {
      scorer: createAnswerRelevancyScorer({
        model: "google/gemini-2.5-flash-lite", // TODO, let's update this to claude once I get credits
      }),
      sampling: { type: "ratio", rate: 1 }, // rate = 1 => score every response
    },
    hallucination: {
      scorer: createHallucinationScorer({
        model: "google/gemini-2.5-flash-lite", // TODO, let's update this to claude once I get credits
      }),
      sampling: { type: "ratio", rate: 1 },
    },
  },
});
