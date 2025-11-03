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
  // Optional validation feedback from previous iteration (for retries in dountil loops)
  validationFeedback: z.string().optional(),
  previousCardData: z
    .object({
      headline: z.string(),
      bulletsJson: z.array(z.string()),
    })
    .optional(),
});

export const WeeklyCardOutputSchema = CreateWeeklyCardInputSchema.extend({
  cardId: z.string(),
  version: z.number(),
  headline: z.string(),
  bulletsJson: z.array(z.string()),
  significanceMax: z.number(),
  coverageTop: z.enum(["high", "medium", "low"]),
  sourceContext: z.string().nullable(),
});

// Card data without the curatedTopics and companyName fields
// (these are passed through for workflow retries but not needed in final card data)
export const WeeklyCardDataSchema = WeeklyCardOutputSchema.omit({
  curatedTopics: true,
  companyName: true,
});

// Validation result schema
export const CardValidationResultSchema = z.object({
  approved: z.boolean(),
  action: z.enum(["APPROVE", "REVISE_CARD", "RESTART_WORKFLOW"]),
  reason: z.string(),
  feedback: z.string(),
});

// Combined validation result + card data for create-and-validate workflow output
// IMPORTANT: Extends CreateWeeklyCardInputSchema to preserve all input fields (companyId, companyName, weekId, curatedTopics)
// at the top level to ensure they're available when dountil loops back for retries (REVISE_CARD)
export const ValidatedCardOutputSchema = CreateWeeklyCardInputSchema.merge(
  CardValidationResultSchema
).extend({
  weeklyCard: WeeklyCardOutputSchema,
});

// Upload card step schemas
// Input is the weekly card output minus companyName and optional validation fields
export const UploadCardInputSchema = WeeklyCardOutputSchema.omit({
  companyName: true,
  validationFeedback: true,
  previousCardData: true,
});

// Output includes success status, message, and the uploaded card data
export const UploadCardOutputSchema = z.object({
  success: z.boolean(),
  cardId: z.string(),
  message: z.string(),
  curatedTopics: z.string(),
  weeklyCard: WeeklyCardDataSchema,
});
