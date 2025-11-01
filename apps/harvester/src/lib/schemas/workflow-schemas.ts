import { z } from "zod";

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
  card_id: z.string(),
  company_id: z.string(),
  week_id: z.string(),
  version: z.number(),
  headline: z.string(),
  bullets_json: z.array(z.string()),
  significance_max: z.number(),
  coverage_top: z.string(),
  source_context: z.string().nullable(),
});
