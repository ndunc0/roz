import { z } from "zod";

export const CompanyInfoSchema = z.object({
  companyName: z.string(),
  blogUrl: z.string(),
  linkedInUrl: z.string(),
});

export const JudgeContentInputSchema = CompanyInfoSchema.extend({
  blogSummaries: z.string(),
  linkedInSummaries: z.string(),
});
