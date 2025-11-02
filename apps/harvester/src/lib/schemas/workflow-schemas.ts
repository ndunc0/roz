import { z } from "zod";

/**
 * Workflow Schemas
 *
 * All schemas in this file use **camelCase** field names for consistency across
 * the application layer (e.g., cardId, companyId, weekId, bulletsJson).
 *
 * When interfacing with the database (Supabase), fields must be converted to
 * **snake_case** (e.g., card_id, company_id, week_id, bullets_json) to match
 * the database column names. This conversion is handled in the upload step.
 */

export const CompanyInfoSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  blogUrl: z.string(),
  linkedInUrl: z.string(),
});

export const JudgeContentInputSchema = CompanyInfoSchema.extend({
  blogSummaries: z.string(),
  linkedInSummaries: z.string(),
});

export const CreateWeeklyCardInputSchema = z.object({
  companyId: z.string(),
  companyName: z.string(),
  weekId: z.string(),
  curatedTopics: z.string(), // JSON string from judge agent
});

export const WeeklyCardOutputSchema = z.object({
  curatedTopics: z.string(), // Pass through from judge step
  cardId: z.string(),
  companyId: z.string(),
  weekId: z.string(),
  version: z.number(),
  headline: z.string(),
  bulletsJson: z.array(z.string()),
  significanceMax: z.number(),
  coverageTop: z.string(),
  sourceContext: z.string().nullable(),
});

// Card data without the curatedTopics field
export const WeeklyCardDataSchema = WeeklyCardOutputSchema.omit({
  curatedTopics: true,
});

// Validation result schema
export const CardValidationResultSchema = z.object({
  approved: z.boolean(),
  action: z.enum(["APPROVE", "REVISE_CARD", "RESTART_WORKFLOW"]),
  reason: z.string(),
  feedback: z.string(),
});

// Combined validation result + card data for create-and-validate workflow output
export const ValidatedCardOutputSchema = CardValidationResultSchema.extend({
  weeklyCard: WeeklyCardOutputSchema,
});

// Digest workflow output schema
export const DigestWorkflowOutputSchema = z.object({
  success: z.boolean(),
  cardId: z.string(),
  message: z.string(),
  curatedTopics: z
    .string()
    .describe(
      "Curated and ranked topics from blog and LinkedIn updates, ready for final email drafting"
    ),
  weeklyCard: WeeklyCardDataSchema,
});
