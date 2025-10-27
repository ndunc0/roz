import { linkedInUpdatesPrompt } from "@lib/prompts/linkedin-updates-prompt";
import { Agent } from "@mastra/core/agent";
import { brightdataFetchLinkedInPostsTool } from "@mastra/tools/brightdata-fetch-linkedin-posts";
import { brightdataPollSnapshotTool } from "@mastra/tools/brightdata-poll-snapshot";

export const linkedInUpdatesAgent = new Agent({
  name: "linkedin-updates-agent",
  description:
    "Analyzes recent LinkedIn posts from a company to identify and summarize the most significant updates, announcements, and strategic insights.",
  instructions: linkedInUpdatesPrompt,
  model: "google/gemini-2.5-flash-lite",
  tools: {
    brightdataFetchLinkedInPosts: brightdataFetchLinkedInPostsTool,
    brightdataPollSnapshot: brightdataPollSnapshotTool,
  },
});
