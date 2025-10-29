import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { CompanyInfoSchema } from "@lib/schemas/workflow-schemas";
import { getBlogUpdatesStep } from "./steps/get-blog-updates-step";
import { getLinkedInUpdatesStep } from "./steps/get-linkedin-updates-step";
import { judgeContentStep } from "./steps/judge-content-step";

export const digestWorkflow = createWorkflow({
  id: "digest-workflow",
  inputSchema: CompanyInfoSchema,
  outputSchema: z.object({
    curatedTopics: z
      .string()
      .describe(
        "Curated and ranked topics from blog and LinkedIn updates, ready for final email drafting"
      ),
  }),
})
  .parallel([getBlogUpdatesStep, getLinkedInUpdatesStep])
  .map(async ({ inputData, getInitData }) => {
    const initData = getInitData();
    const parallelResults = inputData as {
      "get-blog-updates-step": { updateSummaries: string };
      "get-linkedin-updates-step": { updateSummaries: string };
    };

    return {
      companyName: initData.companyName,
      blogUrl: initData.blogUrl,
      linkedInUrl: initData.linkedInUrl,
      blogSummaries: parallelResults["get-blog-updates-step"].updateSummaries,
      linkedInSummaries: parallelResults["get-linkedin-updates-step"].updateSummaries,
    };
  })
  .then(judgeContentStep)
  .commit();
