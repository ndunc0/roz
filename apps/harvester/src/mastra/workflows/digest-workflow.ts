import { createWorkflow } from "@mastra/core/workflows";
import {
  CompanyInfoSchema,
  UploadCardOutputSchema,
} from "@lib/schemas/workflow-schemas";
import { getBlogUpdatesStep } from "./steps/get-blog-updates-step";
import { getLinkedInUpdatesStep } from "./steps/get-linkedin-updates-step";
import { judgeContentStep } from "./steps/judge-content-step";
import { createAndValidateCardWorkflow } from "./create-and-validate-card-workflow";
import { uploadCardStep } from "./steps/upload-card-step";
import { getWeekId } from "@lib/utils";

const MAX_VALIDATION_ITERATIONS = 5;

export const digestWorkflow = createWorkflow({
  id: "digest-workflow",
  inputSchema: CompanyInfoSchema,
  outputSchema: UploadCardOutputSchema,
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
  .dountil(
    createAndValidateCardWorkflow,
    async ({ inputData, iterationCount }) => {
      const { approved, action, reason, feedback } = inputData;

      // Limit iterations to prevent infinite loops
      if (iterationCount && iterationCount >= MAX_VALIDATION_ITERATIONS) {
        console.error(
          `Maximum validation iterations reached (${iterationCount}). Last reason: ${reason}`
        );
        throw new Error(
          `Card validation failed after ${iterationCount} attempts: ${reason}\n\nFeedback: ${feedback}`
        );
      }

      // Handle RESTART_WORKFLOW action
      if (action === "RESTART_WORKFLOW") {
        console.error(`Validator requested workflow restart: ${reason}`);
        throw new Error(
          `Workflow restart requested by validator: ${reason}\n\nFeedback: ${feedback}`
        );
      }

      // Log revision feedback
      if (!approved && action === "REVISE_CARD") {
        console.warn(
          `Card rejected (iteration ${iterationCount || 1}): ${reason}\n\nFeedback: ${feedback}\n\nRetrying card creation...`
        );
        return false; // Continue looping - will recreate the card
      }

      // Approved - exit loop
      console.log("Card approved by validator:", reason);
      return true; // Exit loop and proceed to upload
    }
  )
  .map(async ({ inputData }) => {
    // Extract the validated card data for upload
    const { weeklyCard } = inputData;
    return weeklyCard;
  })
  .then(uploadCardStep)
  .commit();
