import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { CompanyInfoSchema } from "@lib/schemas/workflow-schemas";
import { getBlogUpdatesStep } from "./steps/get-blog-updates-step";
import { getLinkedInUpdatesStep } from "./steps/get-linkedin-updates-step";
import { judgeContentStep } from "./steps/judge-content-step";
import { createWeeklyCardStep } from "./steps/create-weekly-card-step";
import { getWeekId } from "@lib/utils";

export const digestWorkflow = createWorkflow({
  id: "digest-workflow",
  inputSchema: CompanyInfoSchema,
  outputSchema: z.object({
    curatedTopics: z
      .string()
      .describe(
        "Curated and ranked topics from blog and LinkedIn updates, ready for final email drafting"
      ),
    weeklyCard: z.object({
      card_id: z.string(),
      company_id: z.string(),
      week_id: z.string(),
      version: z.number(),
      headline: z.string(),
      bullets_json: z.array(z.string()),
      significance_max: z.number(),
      coverage_top: z.string(),
      source_context: z.string().nullable(),
    }),
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
      linkedInSummaries:
        parallelResults["get-linkedin-updates-step"].updateSummaries,
    };
  })
  .then(judgeContentStep)
  .map(async ({ inputData, getInitData }) => {
    const initData = getInitData();
    const weekId = getWeekId();

    return {
      companyId: initData.companyId,
      companyName: initData.companyName,
      weekId,
      curatedTopics: inputData.curatedTopics,
    };
  })
  .then(createWeeklyCardStep)
  .map(async ({ inputData }) => {
    // Separate curatedTopics from card data
    const { curatedTopics, ...cardData } = inputData;

    return {
      curatedTopics,
      weeklyCard: cardData,
    };
  })
  .commit();
