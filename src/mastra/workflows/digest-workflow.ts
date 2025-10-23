import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { getBlogUpdatesStep } from "./steps/get-blog-updates-step";

export const digestWorkflow = createWorkflow({
  id: "digest-workflow",
  inputSchema: z.object({
    companyName: z
      .string()
      .describe("The name of the company to generate a digest for"),
    blogUrl: z.string().describe("The URL of the company's blog"),
  }),
  outputSchema: z.object({
    digest: z
      .string()
      .describe(
        "A concise digest of recent blog posts from the company's blog"
      ),
  }),
})
  .then(getBlogUpdatesStep)
  .commit();
