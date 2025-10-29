import { linkedInUpdatesPrompt } from "@lib/prompts/linkedin-updates-prompt";
import { Agent } from "@mastra/core/agent";
import { brightdataFetchLinkedInPostsTool } from "@mastra/tools/brightdata-fetch-linkedin-posts";
import { brightdataPollSnapshotTool } from "@mastra/tools/brightdata-poll-snapshot";

export const linkedInUpdatesAgent = new Agent({
  name: "linkedin-updates-agent",
  description:
    "Analyzes recent LinkedIn posts from a company to identify and summarize the most significant updates, announcements, and strategic insights.",
  instructions: linkedInUpdatesPrompt,
  model: "anthropic/claude-haiku-4-5",
  tools: {
    brightdataFetchLinkedInPosts: brightdataFetchLinkedInPostsTool,
    brightdataPollSnapshot: brightdataPollSnapshotTool,
  },
});
