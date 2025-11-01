import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { contentJudgeAgent } from "@mastra/agents/content-judge-agent";
import { JudgeContentInputSchema } from "@lib/schemas/workflow-schemas";

const JudgeContentOutputSchema = z.object({
  curatedTopics: z.string(),
});

export const judgeContentStep = createStep({
  id: "judge-content-step",
  inputSchema: JudgeContentInputSchema,
  outputSchema: JudgeContentOutputSchema,
  execute: async ({ inputData }) => {
    const { blogSummaries, linkedInSummaries, companyName } = inputData;

    const prompt = `You are analyzing content from ${companyName} to determine what should be included in an executive email digest.

Here are the summaries from various sources:

## Blog Post Summaries
${blogSummaries}

## LinkedIn Update Summaries
${linkedInSummaries}

Please analyze all of this information, identify the key topics, score and rank them by significance, and provide your structured judgment on what should be included in the final email digest.`;

    const { text } = await contentJudgeAgent.generate([
      { role: "user", content: prompt },
    ]);

    console.log("Judge Content Step Output:", text);

    return {
      curatedTopics: text,
    };
  },
});
