import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { blogPostSummarizerAgent } from "@mastra/agents/blog-post-summarizer-agent";

const BlogUpdatesInputSchema = z.object({
  blogUrl: z.string(),
  companyName: z.string(),
});

const BlogUpdatesOutputSchema = z.object({
  updateSummaries: z.string(),
});

export const getBlogUpdatesStep = createStep({
  id: "get-blog-updates-step",
  inputSchema: BlogUpdatesInputSchema,
  outputSchema: BlogUpdatesOutputSchema,
  execute: async ({ inputData }) => {
    const { blogUrl } = inputData;

    const prompt = `Please provide concise summaries of the most recent blog posts (last 7 days) from the blog at ${blogUrl}.
    Return a maxiumum of 10 summaries. Focus on key updates and important information that would be relevant to readers interested in ${inputData.companyName}.`;

    const { text } = await blogPostSummarizerAgent.generate([
      { role: "user", content: prompt },
    ]);

    return {
      updateSummaries: text,
    };
  },
});
