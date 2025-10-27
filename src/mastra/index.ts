import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { blogPostSummarizerAgent } from "./agents/blog-post-summarizer-agent";
import { digestWorkflow } from "./workflows/digest-workflow";
import { linkedInUpdatesAgent } from "./agents/linkedin-updates-agent";

export const mastra = new Mastra({
  workflows: { digestWorkflow },
  agents: { blogPostSummarizerAgent, linkedInUpdatesAgent },
  storage: new LibSQLStore({
    // stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false,
  },
  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },
});
