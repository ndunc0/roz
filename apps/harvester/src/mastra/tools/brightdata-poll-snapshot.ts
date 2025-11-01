import { monitorSnapshot, downloadSnapshot } from "@lib/services/brightdata";
import { LinkedInPostSchema } from "@lib/schemas/brightdata-schemas";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const brightdataPollSnapshotTool = createTool({
  id: "poll-brightdata-snapshot",
  description:
    "Polls a Bright Data snapshot ID until data is ready, then downloads and returns the results. Use this tool when the fetch-company-linkedin-posts tool returns a snapshot_id instead of posts. This tool will monitor the snapshot progress every minute (with exponential backoff after 10 minutes) and timeout after 1 hour.",
  inputSchema: z.object({
    snapshotId: z
      .string()
      .describe(
        "The snapshot ID returned from a previous Bright Data request (e.g., 's_mh8jgk9f2hl3u6nxae')"
      ),
  }),
  outputSchema: z.object({
    posts: z.array(LinkedInPostSchema),
    status: z
      .enum(["ready", "failed"])
      .describe("The final status of the snapshot"),
    message: z.string().optional().describe("Additional status information"),
  }),
  execute: async ({ context }) => {
    const { snapshotId } = context;

    console.log(`Starting to monitor snapshot: ${snapshotId}`);

    try {
      // Monitor the snapshot until it's ready or failed
      const monitorResult = await monitorSnapshot(snapshotId);

      if (monitorResult.status === "failed") {
        return {
          posts: [],
          status: "failed" as const,
          message: `Snapshot failed: ${monitorResult.error || "Unknown error"}. Please try the original request again.`,
        };
      }

      if (monitorResult.status === "ready") {
        console.log(`Snapshot ${snapshotId} is ready. Downloading data...`);

        // Download the snapshot data (already filtered for errors)
        const { validPosts, errorCount } = await downloadSnapshot(snapshotId);

        // Validate posts against the schema using safeParse to handle any unexpected formats gracefully
        const posts = validPosts
          .map((post) => {
            const result = LinkedInPostSchema.safeParse(post);
            if (!result.success) {
              console.warn(
                "Failed to parse post, skipping:",
                result.error.errors
              );
              return null;
            }
            return result.data;
          })
          .filter((post): post is z.infer<typeof LinkedInPostSchema> => post !== null);

        console.log(
          `Successfully downloaded ${posts.length} valid posts (${errorCount} errors filtered)`
        );

        const message =
          errorCount > 0
            ? `Successfully retrieved ${posts.length} posts (${errorCount} errors filtered out)`
            : `Successfully retrieved ${posts.length} posts`;

        return {
          posts,
          status: "ready" as const,
          message,
        };
      }

      // This should never happen due to the while loop in monitorSnapshot
      throw new Error(`Unexpected snapshot status: ${monitorResult.status}`);
    } catch (error) {
      console.error("Error polling snapshot:", error);

      // Return a failed status with error information
      return {
        posts: [],
        status: "failed" as const,
        message: `Error polling snapshot: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
