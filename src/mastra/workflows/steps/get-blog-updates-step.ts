import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { blogPostSummarizerAgent } from "@mastra/agents/blog-post-summarizer-agent";
import { CompanyInfoSchema } from "@lib/schemas/workflow-schemas";

const BlogUpdatesOutputSchema = z.object({
  updateSummaries: z.string(),
});

export const getBlogUpdatesStep = createStep({
  id: "get-blog-updates-step",
  inputSchema: CompanyInfoSchema,
  outputSchema: BlogUpdatesOutputSchema,
  execute: async ({ inputData }) => {
    const { blogUrl, companyName } = inputData;

    const prompt = `Please provide concise summaries of the most recent blog posts (last 7 days) from the blog at ${blogUrl}.
    Return a maxiumum of 10 summaries. Focus on key updates and important information that would be relevant to readers interested in ${companyName}.`;

    const { text } = await blogPostSummarizerAgent.generate([
      { role: "user", content: prompt },
    ]);

    return {
      updateSummaries: text || "No recent blog posts found.",
    };
  },
});
