import { createStep } from "@mastra/core/workflows";
import {
  createCompanyWeeklyCard,
  type CompanyWeeklyCardInsert,
} from "@roz/models";
import {
  UploadCardInputSchema,
  UploadCardOutputSchema,
} from "@lib/schemas/workflow-schemas";

export const uploadCardStep = createStep({
  id: "upload-card-step",
  inputSchema: UploadCardInputSchema,
  outputSchema: UploadCardOutputSchema,
  execute: async ({ inputData }) => {
    const { curatedTopics, ...cardData } = inputData;

    // Prepare the insert data for Supabase (convert camelCase to snake_case for database)
    // NOTE: card_id is a GENERATED column (company_id || '__' || week_id) and should NOT be included
    const insertData: CompanyWeeklyCardInsert = {
      company_id: cardData.companyId,
      week_id: cardData.weekId,
      version: cardData.version,
      headline: cardData.headline,
      bullets_json: cardData.bulletsJson,
      significance_max: cardData.significanceMax,
      coverage_top: cardData.coverageTop,
      source_context: cardData.sourceContext,
    };

    console.log(
      "Uploading card to Supabase:",
      `${insertData.company_id}__${insertData.week_id}`
    );

    try {
      const data = await createCompanyWeeklyCard(insertData);

      console.log("Successfully uploaded card to Supabase:", data.card_id);

      return {
        success: true,
        cardId: data.card_id,
        message: `Successfully uploaded card ${data.card_id} to Supabase`,
        curatedTopics,
        weeklyCard: cardData,
      };
    } catch (error) {
      console.error("Failed to upload card to Supabase:", error);
      throw error;
    }
  },
});
