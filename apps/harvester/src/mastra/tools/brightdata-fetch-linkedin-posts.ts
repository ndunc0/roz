import { fetchCompanyLinkedInPosts } from "@lib/services/brightdata";
import { LinkedInPostSchema } from "@lib/schemas/brightdata-schemas";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const brightdataFetchLinkedInPostsTool = createTool({
  id: "fetch-company-linkedin-posts",
  description:
    "Fetches recent LinkedIn posts from a company's LinkedIn page. Returns posts with engagement metrics, content, media, and comments. Use this to analyze a company's social media presence and recent updates.",
  inputSchema: z.object({
    companyLinkedInUrl: z
      .string()
      .describe(
        "The LinkedIn company page URL (e.g., https://www.linkedin.com/company/juicebox-work)"
      ),
    windowDays: z
      .number()
      .optional()
      .describe(
        "Number of days back to fetch posts from. Defaults to 7 days if not specified."
      ),
    maxNumberOfResults: z
      .number()
      .optional()
      .describe(
        "Maximum number of posts to return. Defaults to 20 if not specified."
      ),
  }),
  outputSchema: z.object({
    posts: z.array(LinkedInPostSchema),
    snapshotId: z
      .string()
      .optional()
      .describe(
        "If present, indicates the request is still processing. Use the poll-brightdata-snapshot tool with this ID to retrieve results."
      ),
    message: z
      .string()
      .optional()
      .describe("Additional information about the request status"),
  }),
  execute: async ({ context }) => {
    const { companyLinkedInUrl, windowDays, maxNumberOfResults } = context;

    // Validate LinkedIn URL format
    if (!companyLinkedInUrl.includes("linkedin.com/company/")) {
      throw new Error(
        "Invalid LinkedIn company URL. Must include 'linkedin.com/company/'"
      );
    }

    // Call the Bright Data service
    const response = await fetchCompanyLinkedInPosts({
      companyLinkedInUrl,
      windowDays: windowDays ?? 7,
      maxNumberOfResults: maxNumberOfResults ?? 20,
    });

    console.log("Bright Data response:", response);

    // Check if the response is a snapshot (202 status)
    if (
      response &&
      typeof response === "object" &&
      "snapshot_id" in response &&
      "message" in response
    ) {
      console.log(
        "Request is still in progress, returning snapshot_id for polling"
      );
      return {
        posts: [],
        snapshotId: (response as { snapshot_id: string }).snapshot_id,
        message: (response as { message: string }).message,
      };
    }

    // The response is an array of posts
    const posts = Array.isArray(response) ? response : [];

    return {
      posts,
    };
  },
});
