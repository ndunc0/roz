import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { supabase } from "@roz/supabase";
import type { TablesInsert } from "@roz/supabase/types";

const UploadCardInputSchema = z.object({
  cardId: z.string(),
  companyId: z.string(),
  weekId: z.string(),
  version: z.number(),
  headline: z.string(),
  bulletsJson: z.array(z.string()),
  significanceMax: z.number(),
  coverageTop: z.string(),
  sourceContext: z.string().nullable(),
  curatedTopics: z.string(),
});

const UploadCardOutputSchema = z.object({
  success: z.boolean(),
  cardId: z.string(),
  message: z.string(),
  curatedTopics: z.string(),
  weeklyCard: z.object({
    cardId: z.string(),
    companyId: z.string(),
    weekId: z.string(),
    version: z.number(),
    headline: z.string(),
    bulletsJson: z.array(z.string()),
    significanceMax: z.number(),
    coverageTop: z.string(),
    sourceContext: z.string().nullable(),
  }),
});

export const uploadCardStep = createStep({
  id: "upload-card-step",
  inputSchema: UploadCardInputSchema,
  outputSchema: UploadCardOutputSchema,
  execute: async ({ inputData }) => {
    const { curatedTopics, ...cardData } = inputData;

    // Prepare the insert data for Supabase (convert camelCase to snake_case for database)
    const insertData: TablesInsert<"company_weekly_card"> = {
      card_id: cardData.cardId,
      company_id: cardData.companyId,
      week_id: cardData.weekId,
      version: cardData.version,
      headline: cardData.headline,
      bullets_json: cardData.bulletsJson,
      significance_max: cardData.significanceMax,
      coverage_top: cardData.coverageTop,
      source_context: cardData.sourceContext,
    };

    console.log("Uploading card to Supabase:", insertData.card_id);

    try {
      // Insert the card into the database
      const { data, error } = await supabase
        .from("company_weekly_card")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw new Error(
          `Failed to upload card to Supabase: ${error.message} (${error.code ?? "UNKNOWN"})`
        );
      }

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
