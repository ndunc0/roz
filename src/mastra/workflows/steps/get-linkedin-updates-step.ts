import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { linkedInUpdatesAgent } from "@mastra/agents/linkedin-updates-agent";
import { CompanyInfoSchema } from "@lib/schemas/workflow-schemas";

const LinkedInUpdatesOutputSchema = z.object({
  updateSummaries: z.string(),
});

export const getLinkedInUpdatesStep = createStep({
  id: "get-linkedin-updates-step",
  inputSchema: CompanyInfoSchema,
  outputSchema: LinkedInUpdatesOutputSchema,
  execute: async ({ inputData }) => {
    const { companyName, linkedInUrl } = inputData;

    const prompt = `Please analyze recent LinkedIn posts (last 7 days) from ${companyName} at ${linkedInUrl}.
    Identify and summarize the most significant updates, announcements, and strategic insights.`;

    const { text } = await linkedInUpdatesAgent.generate([
      { role: "user", content: prompt },
    ]);

    return {
      updateSummaries: text,
    };
  },
});
